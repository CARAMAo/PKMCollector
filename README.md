# PKMCollector

Progetto sviluppato per il corso di Cloud Computing dell’Università degli Studi di Salerno.

**PKMCollector** è un'applicazione serverless che sfrutta i servizi di **Microsoft Azure** per offrire funzionalità di indicizzazione e ricerca di carte Pokémon TCG:
  - Ricerca per similarità di immagine;
  - Ricerca testuale per keywords sui metadati delle carte (Nome carta, Illustratore, Rarità, Nome del Set di rilascio) oppure tramite descrizione dell'artwork in linguaggio naturale;

L'applicazione espone due endpoint HTTP implementati tramite **Azure Function App** per ciascuna delle due modalità di ricerca:
   - GET `/api/text-search?q=<query>` restituisce tutte le carte i cui metadati combaciano con la query del client (e.g. la query `ken sugimori base set` restituisce tutte le carte disegnate da Ken Sugimori e che appartengono al Base Set);
     - Se la ricerca per keyword non trova risultati, cerca delle carte che corrispondono visivamente al testo contenuto nella query; 
   - POST `/api/image-search` (multipart/form-data con file immagine): restituisce le informazioni sulla carta rappresentata nell'immagine inviata dal client; 



## Servizi Utilizzati

- **Azure Function App** (Python 3.12, Flex Consumption) con HTTP Trigger;
- **Azure Storage Account** + **Event Grid System Topic** 
- **Azure Cosmos DB (NoSQL)** per i dati delle carte e per la ricerca vettoriale;
- **Azure AI Vision** per calcolare gli embedding delle immagini carte, sia in fase di query che di indicizzazione;
- **Azure OpenAI** per generare descrizioni visive degli artwork delle carte (GPT-4o) e calcolarne gli embedding (text-embedding-ada-002);

## Architettura

## Per eseguire il progetto
Prerequisiti:
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

...