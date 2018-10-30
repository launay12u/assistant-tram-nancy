const request = require('request-promise-native'); // si vous souhaitez faire des requêtes HTTP
const arrets = require('./arrets.json');
const moment = require('moment');
var BreakException = {};

function getArretByName(name) {
	return arrets.filter(
		function(data){return data.name.toLowerCase() === String(name).toLowerCase()}
	)[0];
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
	// si une configuration est requise (en reprenant l'exemple de "key") :
	if (!_this.config.tokenNavitia) return Promise.reject("[assistant-tram-nancy] Erreur : Token API Navitia manquant !");
	if ( !_this.config.travelTime && _this.config.mode === "timeDepart") return Promise.reject("[assistant-tram-nancy] Erreur : Mode timeDepart activer sans localisation !");
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

	var commande = {};
	commande.arretId = _this.config.arretFav;

	// Si commande de base
	if (com === ""){
		commande.direction = _this.config.directionFav;
	}
	// Sinon récupère la direction dans la commande vocale
	else{
		commande.direction = JSON.parse(com).direction;
		// Si c'est un arret
		var arret = getArretByName(commande.direction);
		if( arret !== undefined){
			// Si le numéro d'arret et plus petit que l'arret fav c'est vers le CHU
			var numero_arret_fav = _this.config.arretFav.split('stop_area:ONY:SA:CTP')[1];
			var numero_arret_commande = arret.id.split('stop_area:ONY:SA:CTP')[1];
			if(parseInt(numero_arret_commande)< parseInt(numero_arret_fav)){
				commande.direction = "Vandoeuvre CHU Brabois";
			}
			else{
				commande.direction = "Essey Mouzimpré";
			}
		}
		//Sinon si pas direction de base erreur
		else if(commande.direction !== "Essey Mouzimpré" && commande.direction !== "Vandoeuvre CHU Brabois"){
			if (_this.plugins.notifier) _this.plugins.notifier.action("Excusez-moi mais je n'ai pas reconnu la direction");
			return Promise.reject("[assistant-tram-nancy] Erreur : Direction non reconnu");
		}
	}

	commande.arret = getArretById(commande.arretId);
	travelTime = _this.config.travelTime;

	//Si commande complète
	console.log("[assistant-tram-nancy] Recherche pour : - Arret : "+commande.arret.name+" vers "+commande.direction+" mode : "+_this.config.mode+" timeMode : "+_this.config.modeTime);

	// Prend en compte le temps de trajet si nécessaire
	const requeteTime = _this.config.mode === "timeDepart" ? moment().add(travelTime,'minutes').format('YYYYMMDDTHHmmss') : moment().format('YYYYMMDDTHHmmss');
	const endUrlNavitia = "/stop_schedules?from_datetime="+requeteTime+"&items_per_schedule=3";
	const urlNavitia = startUrlNavitia+commande.arretId+endUrlNavitia;
	console.log('[assistant-tram-nancy] Requete vers : ',urlNavitia);
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
			if(_this.config.mode === "timeDepart"){
				message += "Vous pouvez prendre ";
			}
			message += "le tram à "+getArretById(commande.arretId).name+" vers "+commande.direction+" ";
			if(_this.config.mode === "timeDepart"){
				if(_this.config.modeTime === "timeAt") message += "en partant d'ici à ";
				if(_this.config.modeTime === "timeIn")message += "en partant d'ici dans ";
			}else if(_this.config.modeTime === "timeAt" && _this.config.mode === "timeArret"){
				message+= "arrive à ";
			}else{
				message+="est dans "
			}
			try{
				stop_schedule.date_times.forEach((element,i) => {
					const stopTimeISO = element.date_time;
					const stopTimeString = stopTimeISO.slice(-6);
					if(_this.config.modeTime === "timeAt"){
						var stopTime = {
							"heure" : parseInt(stopTimeString.slice(0,2)),
							"minute" : parseInt(stopTimeString.slice(2,4))
						};
						if(_this.config.mode === "timeDepart"){
							stopTime.minute = Math.round(stopTime.minute-_this.config.travelTime);
							if(stopTime.minute < 0){
								stopTime.minute += 60;
								stopTime.heure -= 1;
							}
						}
						if (stopTime.heure === 0){
							message += "minuit"
						}else{
							message += stopTime.heure+" heure";
						}
						if(stopTime.minute !== 0) message += " "+stopTime.minute
						message += separator[i];
					}else{
						const delay = moment(stopTimeISO,'YYYYMMDDTHHmmss').diff(moment(requeteTime,'YYYYMMDDTHHmmss'),'minutes')
						if (delay > 60){
							message += "plus d'une heure.";
							throw BreakException;
						}else{
							message += delay+" minutes"+separator[i];
						}
					}
				});
			}catch(e){
				if (e !== BreakException) throw e;
			}
		}
		console.log('[assistant-tram-nancy] Message : '+message+'.');
		if (_this.plugins.notifier) return _this.plugins.notifier.action(message+'.')

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
