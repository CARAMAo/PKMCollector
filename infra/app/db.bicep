param location string
param tags object
param resourceToken string

@description('The amount of throughput set. If setThroughput is enabled, defaults to 400.')
param throughput int = 400

@description('Enables throughput setting at this resource level. Defaults to true.')
param setThroughput bool = false

@description('Enables autoscale. If setThroughput is enabled, defaults to false.')
param autoscale bool = true



var options = setThroughput
  ? autoscale
      ? {
          autoscaleSettings: {
            maxThroughput: throughput
          }
        }
      : {
          throughput: throughput
        }
  : {}

resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: 'cosmos-${resourceToken}'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
      }
    ]
    // Enable local auth (keys/connection string) since we avoid RBAC
    disableLocalAuth: false
    publicNetworkAccess: 'Enabled'
    capabilities: [
      {
        name: 'EnableServerless'
      },{
        name: 'EnableNoSQLVectorSearch'
      }
    ]
    capacity: {
      totalThroughputLimit:4000
    }
  }
}
 
resource cosmosDbDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmosDbAccount
  name: 'pkmcollector-db'
  properties: {
    resource: {
      id: 'pkmcollector-db'
    }
  }
}
 
resource cosmosDbCardsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2025-05-01-preview' = {
  parent: cosmosDbDatabase
  name: 'cards'
  properties: {
    options: options
    resource: {
      id: 'cards'
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
          {
            path: '/imageVector/*'
          }
          {
            path: '/captionVector/*'
          }
        ]
        fullTextIndexes: [
          {
            path: '/searchText'
          }
        ]
        vectorIndexes: [
          {
            path: '/imageVector'
            type: 'quantizedFlat'
          }
          {
            path: '/captionVector'
            type: 'quantizedFlat'
          }
        ]
      }
      partitionKey: {
        paths: [
          '/set/id'
        ]
        kind: 'Hash'
        version: 2
      }
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
      }
      vectorEmbeddingPolicy: {
        vectorEmbeddings: [
          {
            path: '/imageVector'
            dataType: 'float32'
            dimensions: 1024
            distanceFunction: 'cosine'
          }
          {
            path: '/captionVector'
            dataType: 'float32'
            dimensions: 1536
            distanceFunction: 'cosine'
          }
        ]
      }
      fullTextPolicy: {
        defaultLanguage: 'en-US'
        fullTextPaths: [
          {
            path: '/searchText'
            language: 'en-US'
          }
        ]
      }
      computedProperties: []
    }
  }
}

output cosmosDbName string = cosmosDbDatabase.name
output cosmosDbAccountName string = cosmosDbAccount.name
output cosmosDbCardsContainer string = cosmosDbCardsContainer.name
output cosmosDbAccountEndpoint string = cosmosDbAccount.properties.documentEndpoint
output cosmosDbEndpoint string = cosmosDbAccount.properties.documentEndpoint
output cosmosDbAccountId string = cosmosDbAccount.id
