# assistant-tram-nancy

Ce plugin de [`assistant-plugins`](https://aymkdn.github.io/assistant-plugins/) permet de connaitre les horaires du Tram du réseau STAN de Nancy grâce à L'API [Navitia](www.navitia.io) via une commande vocale à un Assistant.

Vous pouvez demander les prochains passages depuis votre arrêt favori vers votre direction favorite en une simple demande ou alors vous pouvez spécifier une direction.

Si vous spécifiez une direction vous pouvez demander un arrêt ou une direction. 

Exemple : Si votre arrêt favori est "Nancy gare" alors demandez quand passe le tram vers Maginot vous donnera les horaires dans la direction "Essey Mouzimpré".

## Sommaire

  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Utilisation](#utilisation)

## Installation

Si vous n'avez pas installé [`assistant-plugins`](https://aymkdn.github.io/assistant-plugins/), alors il faut le faire, et sélectionner **tram-nancy** comme plugin.

Si vous avez déjà installé [`assistant-plugins`](https://aymkdn.github.io/assistant-plugins/), et que vous souhaitez ajouter ce plugin, alors :
  - Pour Windows, téléchargez [`install_tram-nancy.bat`](https://github-proxy.kodono.info/?q=https://raw.githubusercontent.com/launay12u/assistant-tram-nancy/master/install_assistant-tram-nancy.bat&download=install_assistant-tram-nancy.bat), ajoutez-le au répertoire `assistant-plugins`, puis exécutez-le en double-cliquant dessus.
  - Pour Linux/MacOS, ouvrir un terminal dans le répertoire `assistant-plugins` et taper :
  `npm install assistant-tram-nancy@latest --save --loglevel error && npm run-script postinstall`

## Configuration

Éditer le fichier `configuration.json` du répertoire `assistant-plugins`.

Dans la section concernant le plugin `tram-nancy`, on trouve le paramètre ci-dessous.

### Paramètre `tokenNavitia`

Obligatoire

C'est le token de l'API Navitia, pour le récupérer il vous faut un compte sur Navitia (gratuit). Vous pouvez en créer un [ici](https://navitia.io/register) et récupérer votre Token d'API dans votre page [profile](https://www.navitia.io/profile/)

### Paramètre `mode`

Optionnel (par défaut à `timeArret`)

Il existe deux modes pour connaitre les horaires :

- `timeArret` : Donne les horaires d'arrivées du tram à l'arrêt.
- `timeDepart` : Donne les horaires en fonction du départ de la maison. (paramètre `travelTime` obligatoire)


### Paramètre `modeTime`

Optionnel (par défaut à `timeAt`)

Il existe deux modes pour la réponse des Assistants :

- `timeAt` : Donne l'heure exacte (ex : à 17h34)
- `timeIn` : Donne le temps restant avant l'arrivée (ex : dans 7 min)


### Paramètre `arretFav`

Obligatoire

L'id de votre arrêt sur l'API Navitia (liste dans le fichier [arrets.json](./arrets.json)).


### Paramètre `directionFav`

Obligatoire

Votre direction favorite : "Essey Mouzimpré" ou "Vandoeuvre CHU Brabois"

### Paramètre `travelTime`

Obligatoire si `timeDepart` est choisi

Votre temps de trajet à pied jusqu'à l'arrêt.

### Exemple de config

```json
"tram-nancy": {
      "tokenNavitia": "MON_TOKEN_NATIVIA",
      "arretFav": "stop_area:ONY:SA:CTP18",
      "directionFav": "Essey Mouzimpré",
      "mode": "timeDepart",
      "modeTime": "timeAt",
      "travelTime": 6,
    }
```

## Utilisation

Pour utiliser le plugin vous devez créer 2 applets IFTTT, l'un pour les horaires de votre arrêt vers votre destination favorite et l'autre pour demander une destination spécifique.

Les deux applets prennent en entrée (`+this`) **Google Assistant** et en sortie (`+that`) **Pushbullet**.

1. Le premier applet correspond à la commande par défaut avec votre arrêt favori et la direction favorite :
* Dans l'entrée Google Assistant choissisez **Say a simple phrase**
* Choisissez la ou les phrases pour déclencher la commande (Ex: "Quand passe le prochain tram ?")
* Choisissez une phrase de réponse (Ex: "Je regarde")
* Mettez en Français

Ensuite dans la sortie Pushbullet :
* Choisissez **Push a note**
* Dans **title** mettre `Assistant`
* Dans **message** mettre `tram-nancy`

2. Pour le second applet qui va servir pour les requêtes vers une direction spécifique (un arrêt ou une direction) :
* Dans l'entrée Google Assistant choissisez **Say a phrase with a text ingredient**
* Choisissez la ou les phrases pour déclencher la commande (Ex: "Quand passe le prochain tram vers $ ?"), le `$` sert à ajouter une variable, ici la direction demandée.
* Choisissez une phrase de réponse (Ex: "Je regarde")
* Mettez en Français

Ensuite dans la sortie Pushbullet :
* Choisissez **Push a note**
* Dans **title** mettre `Assistant`
* Dans **message** mettre `tram-nancy_{"direction":"\{\{TextField\}\}"}` (*\{\{TextField\}\}* est l'ingrédient généré par IFTTT)

Une question, un bug ou une demande ? [Merci de me prévenir](https://github.com/launay12u/assistant-tram-nancy/issues) !
