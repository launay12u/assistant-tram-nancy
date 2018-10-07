# assistant-tram-nancy

Ce plugin de [`assistant-plugins`](https://aymkdn.github.io/assistant-plugins/) permet de connaitre les horaires du Tram du reseau STAN de Nancy grâce à L'API [Navitia](www.navitia.io) via une commande vocale à un Assitant.

## Sommaire

  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Utilisation](#utilisation)

## Installation

Si vous n'avez pas installé [`assistant-plugins`](https://aymkdn.github.io/assistant-plugins/), alors il faut le faire, et sélectionner **tram-nancy** comme plugin.

Si vous avez déjà installé [`assistant-plugins`](https://aymkdn.github.io/assistant-plugins/), et que vous souhaitez ajouter ce plugin, alors :
  - Pour Windows, télécharger [`install_transport-nancy.bat`](https://github-proxy.kodono.info/?q=https://raw.githubusercontent.com/Aymkdn/assistant-tram-nancy/master/install_livebox.bat&download=install_livebox.bat) dans le répertoire `assistant-plugins`, puis l'exécuter en double-cliquant dessus.
  - Pour Linux/MacOS, ouvrir une console dans le répertoire `assistant-plugins` et taper :
  `npm install assistant-tram-nancy@latest --save --loglevel error && npm run-script postinstall`

Si vous n'avez pas de compte Navitia il faut vous en créer un [ici](https://navitia.io/register) pour avoir votre Token d'API.
## Configuration

Éditer le fichier `configuration.json` du répertoire `assistant-plugins`.

Dans la section concernant le plugin `tram-nancy`, on trouve le paramètre ci-dessous.

### Paramètre `tokenNavitia`

Obligatoire,

C'est le token de l'API Navitia, pour le récupérer il vous faut un compte sur Navitia (Gratuit).

### Paramètre `mode`

Optionnel (par defaut à `timeArret`)

Il existe deux mode pour connaitre les horaires :

- `timeArret` : Donne les horaires d'arrivées du tram à l'arret.
- `timeDepart` : Donne les horaires en fonction du depart de la maison. (`location` obligatoire)


### Paramètre `modeTime`

Optionnel (par defaut à `timeAt`)


Il existe deux mode pour la reponse des Assitants :

- `timeAt` : Donne l'heure exact (ex : à 17h34)
- `timeIn` : Donne le temps restant avant l'arrivée (ex : dans 7 min)


### Paramètre `arretFav`

Obligatoire pour l'applet rapide ('À quelle heure est le prochain tram ?'), sinon obligation d'ajouter l'arret

L'id de votre arret sur l'API Navitia (Liste dans le fichier [arrets.js](./arrets.js) ou sur le site Navitia).

### Paramètre `location`

Obligatoire si `timeDepart` est choisit

Vos coordonnées GPS :

```json
{
    'lat': XX.XXXX,
    'lng': XX.XXXX
}
```


### Paramètre `directionFav`

Obligatoire pour l'applet rapide ('À quelle heure est le prochain tram ?'), sinon obligation d'ajouter la direction


Votre direction favorite  : "Essey Mouzimpré" ou "Vandoeuvre CHU Brabois"


## Utilisation

J'ai créé des applets IFTTT Google home pour l'utilisation du plugin :


Une applet ne fonctionne pas, une question, un bug ou une demande ? [Merci de me prévenir](https://github.com/launay12u/assistant-tram-nancy/issues) !
