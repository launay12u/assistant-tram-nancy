const request = require('request-promise-native'); // si vous souhaitez faire des requêtes HTTP
const arrets = require('./arrets.js').arrets;
const moment = require('moment');
const distance = require('google-distance');

function getArretByName(name) {
	return arrets.filter(
		function(data){return data.name === name}
	);
}

function getArretById(id) {
	return arrets.filter(
		function(data){return data.id === id}
	);
}


/**
 * on crée une fonction `AssistantTemplate`
 * @param {Object} configuration L'objet `configuration` qui vient du fichier configuration.json
 */
var AssistantTemplate = function(configuration) {
  // par exemple configuration.key si on a `{ "key": "XXX" }` dans le fichier configuration.json
  // exemple: this.key = configuration.key;
  this.config = configuration;
  if (!this.config.mode) this.config.mode = "timeArret";
  if (!this.config) this.config.modeTime = "timeAt";
};

/**
 * Il faut ensuite créer une fonction `init()`
 *
 * @param  {Object} plugins Un objet représentant les autres plugins chargés
 * @return {Promise}
 */
AssistantTemplate.prototype.init = async function(plugins) {
  this.plugins = plugins;
  const _this = this;
  // si une configuration est requise (en reprenant l'exemple de "key") :
	if (!_this.config.tokenNavitia) return Promise.reject("[assistant-tram-nancy] Erreur : Token API Navitia manquant !");
	if ((!_this.config.location.lat || _this.config.location.lng ) && _this.config.mode === "timeDepart") return Promise.reject("[assistant-tram-nancy] Erreur : Mode timeDepart activer sans localisation !");

	if (_this.config.location.lat && _this.config.location.lng && _this.config.arretFav){
		try{
			const responseNavitia  = await request({
				url :"https://api.navitia.io/v1/coverage/fr-ne/stop_areas/"+_this.config.arretFav,
				method :"GET",
				header :{
					"Authorization": _this.config.tokenNavitia
				}
			});

			const arretLat = responseNavitia.stop_areas[0].coord.lat;
			const arretLng = responseNavitia.stop_areas[0].coord.lon;

			try{
			const responseGoogle = await distance.get({
				origin: _this.config.location.lat + "," + _this.config.location.lng,
				destination:arretLat+","+arretLng,
				mode: 'walking'
			});
			_this.config.travelTime = Math.round(responseGoogle.durationValue/60)

			}catch (err) {
				return Promise.reject("[assistant-tram-nancy] Erreur : "+err.message);
			}
		}catch (err) {
			return Promise.reject("[assistant-tram-nancy] Erreur : "+err.message);
		}
	}
	this.plugins.assistant.saveConfig('assistant-tram-nancy', this.config);
	return Promise.resolve(this);
};

/**
 * Fonction appelée par le système central
 *
 * @return {Promise}
 * @param com
 */
AssistantTemplate.prototype.action = async function(com) {
	const _this=this;
	const startUrlNavitia = "https://api.navitia.io/v1/coverage/fr-ne/stop_areas/";
	let travelTime;
	let commande = '"'+com.replace(/'/g,'\\"').replace(/, /g,",")+'"';
	commande = JSON.parse(commande);

	//Log debut commande avec arguments
	console.log("[assistant-tram-nancy] Recherche pour : - Arret : "+commande.arret+" vers "+commande.direction);

	if (typeof commande==="string") commande = JSON.parse(commande);

	//Si commande rapide mais manque un fav ou les 2
	if ((commande.arret === "favori" && commande.direction === "favori") && (!_this.config.arretFav || !_this.config.directionFav)){
		if (_this.plugins.notifier) _this.plugins.notifier.action("Excusez-moi mais vous n'avez pas configuré vos favoris.");
		return Promise.reject("[assistant-tram-nancy] Erreur : Favoris non configurés ");
	}
	//Si commande rapide OK
	else if(commande.arret === "favori" && commande.direction === "favori"){
		commande.arretId = _this.config.arretFav;
		commande.direction = _this.config.directionFav;
		commande.arret = getArretById(commande.arretId).name;

		travelTime = _this.config.travelTime;

	}
	//Si commande complète
	else {
		//Traduire l'arret en id d'arret => arrets.js
		commande.arretId = getArretByName(commande.arret).id;
		try{
			const  responseNavitia = await request({
				url :"https://api.navitia.io/v1/coverage/fr-ne/stop_areas/"+commande.arretId,
				method :"GET",
				header :{
					"Authorization": _this.config.tokenNavitia
				}
			});

			const arretLat = responseNavitia.stop_areas[0].coord.lat;
			const arretLng = responseNavitia.stop_areas[0].coord.lon;

			try{
				const responseGoogle = await distance.get({
					origin: _this.config.location.lat + "," + _this.config.location.lng,
					destination:arretLat+","+arretLng,
					mode: 'walking'
				});
				travelTime = Math.round(responseGoogle.durationValue/60)

			}catch (err) {
				return Promise.reject("[assistant-tram-nancy] Erreur : "+err.message);
			}
		}catch (err) {
			return Promise.reject("[assistant-tram-nancy] Erreur : "+err.message);
		}
	}
	const requeteTime = _this.config.mode === "timeDepart" ? moment().add(travelTime,'seconds').format('YYYYMMDDTHHmmss') : moment().format('YYYYMMDDTHHmmss');
	const endUrlNavitia = "/departures?from_date="+requeteTime;
	const urlNavitia = startUrlNavitia+commande.arretId+endUrlNavitia;
	try{
		const response = await request({
			url : urlNavitia,
			method :"GET",
			header :{
				"Authorization": _this.config.tokenNavitia
			}
		});
		const separator = [", "," ou ",""];
		const count = response.departures > 3 ? 3 : response.departures;
		if (count === 0 ){
			if (_this.plugins.notifier) _this.plugins.notifier.action("Excusez-moi mais je n'ai rien trouvé.");
			return Promise.reject("[assistant-tram-nancy] Reponse : Aucun resultat ");
		}else{
			let message = "";
			if(_this.config.mode === "timeAt" && _this.config.modeTime === 	"timeDepart"){
				message += "Vous pouvez prendre ";
			}
			message += "le tram à "+getArretById(commande.arretId).name+" vers "+response.departures[0].display_informations.headsign+" ";

			if(_this.config.mode === "timeAt" && _this.config.modeTime === 	"timeDepart"){
				message += "en partant à ";
			}else if(_this.config.mode === "timeAt" && _this.config.modeTime === 	"timeArret"){
				message+= "arrive à ";
			}else{
				message+="est dans "
			}
			for (let i = 0; i > count-1;i++){
				const stopTimeISO = response.departures[i].stop_date_time.arrival_date_time;
				const stopTimeString = stopTimeISO.slice(-6);
				const stopTime = {
					"heure" : stopTimeString.slice(0,2),
					"minute" : stopTimeString.slice(2,4)
				};
				if(_this.config.mode === "timeAt"){
						message += stopTime.heure+" heure "+stopTime.minute+separator[i];
				}else{
					const timeString = requeteTime.slice(-6);
					const delay = stopTimeString-timeString;
					message += delay+" minutes"+separator[i];

				}
			}
		}
		console.log('[assistant-tram-nancy] Message : '+message);
		if (_this.plugins.notifier) return _this.plugins.notifier.action(speak)

	}catch (err) {
		return Promise.reject("[assistant-tram-nancy] Erreur : "+err.message);
	}


};

/**
 * Initialisation du plugin
 *
 * @param  {Object} configuration La configuration
 * @param  {Object} plugins Un objet qui contient tous les plugins chargés
 * @return {Promise} resolve(this)
 */
exports.init=function(configuration, plugins) {
  return new AssistantTemplate(configuration).init(plugins)
  .then(function(resource) {
    console.log("[assistant-tram-nancy] Plugin chargé et prêt.");
    return resource;
  })
};

/**
 * À noter qu'il est également possible de sauvegarder des informations supplémentaires dans le fichier configuration.json général
 * Pour cela on appellera this.plugins.assistant.saveConfig('nom-du-plugin', {configuration_en_json_complète}); (exemple dans le plugin freebox)
 */
