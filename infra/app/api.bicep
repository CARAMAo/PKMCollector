param name string
@description('Primary location for all resources & Flex Consumption Function App')
param location string = resourceGroup().location
param tags object = {}
param applicationInsightsName string = ''
param appServicePlanId string
param appSettings object = {}
param runtimeName string 
param visionAccountName string
param openAIAccountName string
param openAIDeploymentName string
param runtimeVersion string 
param serviceName string = 'api'
param storageAccountName string
param storageCardsUploadsContainerName string
param cosmosDbAccountName string
param cosmosDatabaseName string
param cosmosContainerName string
param deploymentStorageContainerName string
param instanceMemoryMB int = 2048
param maximumInstanceCount int = 100
param identityId string = ''
param identityClientId string = ''
param enableBlob bool = true


// var applicationInsightsIdentity = 'ClientId=${identityClientId};Authorization=AAD'
var kind = 'functionapp,linux'

var stgConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${stg.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
// Base application settings (no RBAC/managed identity storage wiring)
var baseAppSettings = {
  APPLICATIONINSIGHTS_CONNECTION_STRING: applicationInsights.properties.ConnectionString
  DEPLOYMENT_STORAGE_CONNECTION_STRING: stgConnectionString
  AZURE_VISION_ENDPOINT: vision.properties.endpoint
  AZURE_VISION_KEY:vision.listKeys().key1
  AZURE_OPENAI_ENDPOINT: openAI.properties.endpoint
  AZURE_OPENAI_API_KEY: openAI.listKeys().key1
  AZURE_OPENAI_DEPLOYMENT: openAIDeploymentName
  AZURE_STORAGE_ACCOUNT_NAME:storageAccountName
  AZURE_STORAGE_ACCOUNT_KEY:stg.listKeys().keys[0].value
  AZURE_STORAGE_CARDS_UPLOADS_CONTAINER_NAME:storageCardsUploadsContainerName
  COSMOS_CONNECTION_STRING:cosmosDbAccount!.listConnectionStrings().connectionStrings[0].connectionString
  COSMOS_CONNECTION: cosmosDbAccount!.listConnectionStrings().connectionStrings[0].connectionString
  COSMOS_DB_NAME: cosmosDatabaseName
  COSMOS_CARDS_CONTAINER_NAME: cosmosContainerName
  AzureWebJobsStorage: stgConnectionString
}

// Merge all app settings (expects AzureWebJobsStorage and other values passed via appSettings)
var allAppSettings = union(appSettings, baseAppSettings)

resource stg 'Microsoft.Storage/storageAccounts@2022-09-01' existing = {
  name: storageAccountName
}

resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = if (!empty(cosmosDbAccountName)) {
  name: cosmosDbAccountName
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' existing = if (!empty(applicationInsightsName)) {
  name: applicationInsightsName
}

resource vision 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {name: visionAccountName}

resource openAI 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {name: openAIAccountName}

// Create a Flex Consumption Function App to host the API
module api 'br/public:avm/res/web/site:0.15.1' = {
  name: '${serviceName}-flex-consumption'
  params: {
    kind: kind
    name: name
    location: location
    tags: union(tags, { 'azd-service-name': serviceName })
    serverFarmResourceId: appServicePlanId
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${stg.properties.primaryEndpoints.blob}${deploymentStorageContainerName}'
          authentication: {
            type: 'storageaccountconnectionstring'
            storageAccountConnectionStringName: 'DEPLOYMENT_STORAGE_CONNECTION_STRING'
          }
        }
      }
      scaleAndConcurrency: {
        instanceMemoryMB: instanceMemoryMB
        maximumInstanceCount: maximumInstanceCount
      }
      runtime: {
        name: runtimeName
        version: runtimeVersion
      }
      
    }
    siteConfig: {
      alwaysOn: false
      cors: {
        allowedOrigins: ['https://portal.azure.com']
      }
    }
    
    appSettingsKeyValuePairs: allAppSettings
  }
}

output SERVICE_API_NAME string = api.outputs.name
