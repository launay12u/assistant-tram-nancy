const request = require('request-promise-native'); // si vous souhaitez faire des requêtes HTTP
const arrets = require('./arrets.json');
const moment = require('moment');
const distance = require('google-distance');

function getArretByName(name) {
	return arrets.filter(
		function(data){return data.name === String(name)}
	)[Ø];
}

function getArretById(id) {
	return arrets.filter(
		function(data){return data.id === String(id)}
	)[0];
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
	if(!_this.config.googleDistanceKey){
		return Promise.reject("[assistant-tram-nancy] Erreur : Google distance API Key manquante !");
	}else{
		distance.apiKey = _this.config.googleDistanceKey;

	}
	// si une configuration est requise (en reprenant l'exemple de "key") :
	if (!_this.config.tokenNavitia) return Promise.reject("[assistant-tram-nancy] Erreur : Token API Navitia manquant !");
	if ((_this.config.location.lat === 0 || _this.config.location.lng === 0 ) && _this.config.mode === "timeDepart") return Promise.reject("[assistant-tram-nancy] Erreur : Mode timeDepart activer sans localisation !");

	if (_this.config.location.lat && _this.config.location.lng && _this.config.arretFav){
		try{
			const responseNavitia  = await request({
				url :"https://api.navitia.io/v1/coverage/fr-ne/stop_areas/"+_this.config.arretFav,
				method :"GET",
				headers :{
					"Authorization": _this.config.tokenNavitia
				}
			});
			var responseNavitiaJson = JSON.parse(responseNavitia);
			const arretLat = responseNavitiaJson.stop_areas[0].coord.lat;
			const arretLng = responseNavitiaJson.stop_areas[0].coord.lon;

			distance.get(
				{
				origin: _this.config.location.lat + "," + _this.config.location.lng,
				destination:arretLat+","+arretLng,
				mode: 'walking'
				},
				function(err, data) {
					if (err) return Promise.reject("[assistant-tram-nancy] Erreur : "+err.message);
					_this.config.travelTime = Math.round(data.durationValue/60);

				}
			);
		}catch (err) {
			console.log(err);
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

	commande = JSON.parse(com);
	const startUrlNavitia = "https://api.navitia.io/v1/coverage/fr-ne/stop_areas/";
	var travelTime;

	//Log debut commande avec arguments

	console.log("[assistant-tram-nancy] Recherche pour : - Arret : "+commande.arret+" vers "+commande.direction+" mode : "+_this.config.mode+" timeMode : "+_this.config.modeTime);

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
		commande.arret = getArretById(commande.arretId);
		travelTime = _this.config.travelTime;
	}
	//Si commande complète
	else {
		commande.arretId = getArretByName(commande.arret).id;
		try{
			const  responseNavitia = await request({
				url :"https://api.navitia.io/v1/coverage/fr-ne/stop_areas/"+commande.arretId,
				method :"GET",
				headers :{
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
	const endUrlNavitia = "/stop_schedules?from_date="+requeteTime+"&items_per_schedule=3";
	const urlNavitia = startUrlNavitia+commande.arretId+endUrlNavitia;
	try{
		var response = await request({
			url : urlNavitia,
			method :"GET",
			headers :{
				"Authorization": _this.config.tokenNavitia
			}
		});
		response = JSON.parse(response);
		const separator = [", "," ou ",""];
		if (!response.stop_schedules ){
			if (_this.plugins.notifier) _this.plugins.notifier.action("Excusez-moi mais je n'ai rien trouvé.");
			return Promise.reject("[assistant-tram-nancy] Reponse : Aucun resultat ");
		}else{
			//recup le bon stop_schedules
			var stop_schedule = response.stop_schedules.filter(function (entry) {
				return entry.route.direction.name.split(" (")[0] === commande.direction;
			})[0];
			var message = "";
			if(_this.config.mode === "timeAt" && _this.config.modeTime === 	"timeDepart"){
				message += "Vous pouvez prendre ";
			}
			message += "le tram à "+getArretById(commande.arretId).name+" vers "+commande.direction" ";

			if(_this.config.modeTime === "timeAt" && _this.config.mode === "timeDepart"){
				message += "en partant à ";
			}else if(_this.config.modeTime === "timeAt" && _this.config.mode === "timeArret"){
				message+= "arrive à ";
			}else{
				message+="est dans "
			}
			stop_schedule.date_times.forEach((element,i) => {
				const stopTimeISO = element.date_time;
				const stopTimeString = stopTimeISO.slice(-6);
				const stopTime = {
					"heure" : stopTimeString.slice(0,2),
					"minute" : stopTimeString.slice(2,4)
				};
				if(_this.config.modeTime === "timeAt"){
						message += stopTime.heure+" heure "+stopTime.minute+separator[i];
				}else{
					const timeString = requeteTime.slice(-6);
					const delay = Math.round((stopTimeString-timeString)/60);
					message += delay+" minutes"+separator[i];

				}
			});
		}
		console.log('[assistant-tram-nancy] Message : '+message);
		if (_this.plugins.notifier) return _this.plugins.notifier.action(message)

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
