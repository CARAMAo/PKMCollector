Progetto sviluppato per il corso di Cloud Computing dell’Università degli Studi di Salerno.

# PKMCollector

**pkm-Collector** è un’app iOS per riconoscere, consultare e gestire carte Pokémon TCG, consentendo di tenere traccia della propria collezione.

Le funzionalità principali dell'app includono:

- **Scansione carte**: tramite fotocamera è possibile scansionare una o più carte e identificarle per recuperarne le informazioni principali.

- **Ricerca testuale**: permette di cercare per nome della carta, nome del set o illustratore, oppure fornire una descrizione visiva della carta e recuperare le carte che più si avvicinano alla descrizione.

- **Dettagli carta**: visualizzazione delle info principali delle carte: nome, set, data di rilascio, numero identificativo, rarità, illustratore, oltre alla possibilità di visionare i prezzi aggiornati da TCGPlayer.com.

- **Collezione personale**: tracciamento della collezione personale, con la possibilità di specificare il numero di copie in possesso per ciascuna carta.

<div style=" justify-content:center; display:flex; flex-wrap:wrap; gap:32px">
<img style="border-radius:24px; border:5px solid #333 ;" src="repo-files/IMG_7808 2.PNG" height=400>
<img style="border-radius:24px; border:5px solid #333 ;" src="repo-files/app.gif" height=400>
<img style="border-radius:24px; border:5px solid #333 ;" src="repo-files/IMG_7807 2.PNG"height=400>
</div>





<!-- **PKMCollector** è un'applicazione serverless che sfrutta i servizi di **Microsoft Azure** per offrire funzionalità di indicizzazione e ricerca di carte Pokémon TCG:
  - Ricerca per similarità di immagine;
  - Ricerca testuale per keywords sui metadati delle carte (Nome carta, Illustratore, Rarità, Nome del Set di rilascio) oppure tramite descrizione dell'artwork in linguaggio naturale;

L'applicazione espone due endpoint HTTP implementati tramite **Azure Function App** per ciascuna delle due modalità di ricerca:
   - GET `/api/text-search?q=<query>` restituisce tutte le carte i cui metadati combaciano con la query del client (e.g. la query `ken sugimori base set` restituisce tutte le carte disegnate da Ken Sugimori e che appartengono al Base Set);
     - Se la ricerca per keyword non trova risultati, cerca delle carte che corrispondono visivamente al testo contenuto nella query; 
   - POST `/api/image-search` (multipart/form-data con file immagine): restituisce le informazioni sulla carta rappresentata nell'immagine inviata dal client; 
 -->


## Servizi Utilizzati

- **Azure Function App** (Python 3.12, Flex Consumption) con HTTP Trigger;
- **Azure Storage Account** + **Event Grid System Topic** 
- **Azure Cosmos DB (NoSQL)** per i dati delle carte e per la ricerca vettoriale;
- **Azure AI Vision** per calcolare gli embedding delle immagini carte, sia in fase di query che di indicizzazione;
- **Azure OpenAI** per generare descrizioni visive degli artwork delle carte (GPT-4o) e calcolarne gli embedding (text-embedding-ada-002);

## Architettura

<img src="repo-files/pkmcollector-architecture.png" style="background-color:white;"/>

## Guida all'utilizzo

### Backend Azure

#### Prerequisiti
- Una Azure Subscription
- `az` (Azure CLI) e `azd` (Azure Developer CLI)
- Python 3.12
- Azure Functions Core Tools v4 (`func`)

Comandi

```bash
azd auth login

azd up     //provisioning e deploy automatizzato

azd deploy //per ridistribuire modifiche al codice
```

### pkm-Collector App iOS

L’app è stata sviluppata con React Native e Expo (SDK 52) e può essere eseguita localmente come build di sviluppo iOS.

#### Prerequisiti

- Xcode 16.x e Xcode Command Line Tools
- CocoaPods 
- Un dispositivo iOS 15.1+ con Developer Mode attivata
- Node.js

#### Step
1. Clonare il repository e spostarsi nella cartella `pkmcollector-app`. 

```
cd pkmcollector-app
npm install
```

2. Apri la cartella `pkmcollector-app/ios/` in Xcode.
    - Seleziona il target dell’app e vai alla tab “Signing & Capabilities”.
    - Abilita “Automatically manage signing”.
    - Imposta il tuo “Team”.
    - Cambia il “Bundle Identifier” con uno univoco (ad es. `com.tuonome.pkmcollector`).

3. Modificare la proprietà `expo.ios.bundleIdentifier` nel file `app.json` in accordo a quanto specificato in Xcode.

2. Compilare e installare la build di sviluppo su dispositivo fisico con collegamento USB:

```
npm run ios
```
- La prima build può richiedere diversi minuti. Al termine dell'installazione comparirà un QR code nel terminale che è possibile inquadrare per avviare l'app.
- Alla prima installazione, iOS richiederà di autorizzare l'account sviluppatore in `Impostazioni > Generali > VPN e gestione dispositivo`.

5. Dopo aver compilato e installato con successo la build di sviluppo è possibile saltare la fase di compilazione avviando solamente il server di sviluppo e aprendo l'app sul dispositivo iOS connesso in LAN.
```
npm run start
```

