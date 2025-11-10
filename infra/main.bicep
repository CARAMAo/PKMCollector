targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the the environment which is used to generate a short unique hash used in all resources.')
param environmentName string

@minLength(1)
@description('Primary location for all resources & Flex Consumption Function App')
@allowed([
  'australiaeast'
  'australiasoutheast'
  'brazilsouth'
  'canadacentral'
  'centralindia'
  'centralus'
  'eastasia'
  'eastus'
  'eastus2'
  'eastus2euap'
  'francecentral'
  'germanywestcentral'
  'italynorth'
  'japaneast'
  'koreacentral'
  'northcentralus'
  'northeurope'
  'norwayeast'
  'southafricanorth'
  'southcentralus'
  'southeastasia'
  'southindia'
  'spaincentral'
  'swedencentral'
  'uaenorth'
  'uksouth'
  'ukwest'
  'westcentralus'
  'westeurope'
  'westus'
  'westus2'
  'westus3'
])
@metadata({
  azd: {
    type: 'location'
  }
})

param location string
param visionLocation string = 'francecentral'
param apiServiceName string = 'functions-pkmcollector'
param apiUserAssignedIdentityName string = ''
param applicationInsightsName string = 'appipkmcollector'
param appServicePlanName string = 'asppkmcollector'
param logAnalyticsName string = 'logspkmcollector'
param resourceGroupName string = ''
param storageAccountName string = 'storagepkmcollector'
param storageCardsUploadsContainerName string = 'cards-uploads'

@description('Id of the user identity to be used for testing and debugging. This is not required in production. Leave empty if not needed.')
param principalId string = deployer().objectId

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }
var functionAppName = !empty(apiServiceName) ? apiServiceName : '${abbrs.webSitesFunctions}api-${resourceToken}'
var deploymentStorageContainerName = 'app-package-${take(functionAppName, 32)}-${take(toLower(uniqueString(functionAppName, resourceToken)), 7)}'

// Cosmos DB settings - parameterized
@description('The name of the Cosmos DB database')
param cosmosDatabaseName string = 'db-pkmcollector'

@description('The name of the lease container for Cosmos DB change feed')
param cosmosLeaseContainer string = 'leases'

// Organize resources in a resource group
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: !empty(resourceGroupName) ? resourceGroupName : '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

module cog './app/cog.bicep' = {
  name:'cog'
  scope:rg
  params: {
    visionResourceName:'pkmcollector-vision-${resourceToken}'
    openAIResourceName:'pkmcollector-openai-${resourceToken}'
  }
}

// Create an App Service Plan to group applications under the same payment plan and SKU
module appServicePlan 'br/public:avm/res/web/serverfarm:0.1.1' = {
  name: 'appserviceplan'
  scope: rg
  params: {
    name: !empty(appServicePlanName) ? appServicePlanName : '${abbrs.webServerFarms}${resourceToken}'
    sku: {
      name: 'FC1'
      tier: 'FlexConsumption'
    }
    reserved: true
    location: location
    tags: tags
  }
}

module api './app/api.bicep' = {
  name: 'functions'
  scope: rg
  params: {
    name: functionAppName
    location: location
    tags: tags
    applicationInsightsName: monitoring.outputs.name
    appServicePlanId: appServicePlan.outputs.resourceId
    runtimeName: 'python'
    runtimeVersion: '3.12'
    storageAccountName: storage.outputs.name
    storageCardsUploadsContainerName: storageCardsUploadsContainerName
    cosmosDbAccountName: cosmosDb.outputs.cosmosDbAccountName
    cosmosDatabaseName: cosmosDb.outputs.cosmosDbName
    cosmosContainerName: cosmosDb.outputs.cosmosDbCardsContainer
    // cosmosDatabaseName: cosmosDb.outputs.cosmosDbName
    // cosmosContainerName: cosmosDb.outputs.cosmosDbCardsContainer
    // cosmosLeaseContainerName: cosmosLeaseContainer
    visionAccountName: cog.outputs.visionAccountName
    openAIAccountName: cog.outputs.openAIAccountName
    openAIDeploymentName: cog.outputs.openAIDeploymentName
    // userUploadsContainer: 'user-uploads'
    enableBlob: storageEndpointConfig.enableBlob
    deploymentStorageContainerName: deploymentStorageContainerName
    appSettings: {
    }
  }
}

// Cosmos DB Setup
module cosmosDb './app/db.bicep' = {
  name: 'cosmosDb'
  scope: rg
  params: {
    resourceToken: resourceToken
    location: location
    tags: tags
  }
}

// Storage account
module storage 'br/public:avm/res/storage/storage-account:0.8.3' = {
  name: 'storage'
  scope: rg
  params: {
    name: !empty(storageAccountName) ? storageAccountName : '${abbrs.storageStorageAccounts}${resourceToken}'
    allowBlobPublicAccess: true
    allowSharedKeyAccess: true // Disable local authentication methods as per policy
    dnsEndpointType: 'Standard'
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
    blobServices: {
      containers: [{name: storageCardsUploadsContainerName,properties:{publicAccess:'Enabled'}},{name:deploymentStorageContainerName}]
    }
    
    minimumTlsVersion: 'TLS1_2'  // Enforcing TLS 1.2 for better security
    location: location
    tags: tags
    skuName:'Standard_LRS'
  }
}

// Define the configuration object locally to pass to the modules
var storageEndpointConfig = {
  enableBlob: true  // Required for AzureWebJobsStorage, .zip deployment, Event Hubs trigger and Timer trigger checkpointing
  enableQueue: false  // Required for Durable Functions and MCP trigger
  enableTable: false  // Required for Durable Functions and OpenAI triggers and bindings
  enableFiles: false   // Not required, used in legacy scenarios
  allowUserIdentityPrincipal: true   // Allow interactive user identity to access for testing and debugging
}

// Consolidated Role Assignments
// module rbac 'app/rbac.bicep' = {
//   name: 'rbacAssignments'
//   scope: rg
//   params: {
//     storageAccountName: storage.outputs.name
//     appInsightsName: monitoring.outputs.name
//     managedIdentityPrincipalId: apiUserAssignedIdentity.outputs.principalId
//     userIdentityPrincipalId: principalId
//     enableBlob: storageEndpointConfig.enableBlob
//     enableQueue: storageEndpointConfig.enableQueue
//     enableTable: storageEndpointConfig.enableTable
//     enableCosmosDb: true
//     cosmosDbAccountName: cosmosDb.outputs.cosmosDbAccountName
//     allowUserIdentityPrincipal: storageEndpointConfig.allowUserIdentityPrincipal
//     visionAccountName: vision.outputs.visionAccountName
//   }
// }

// Monitor application with Azure Monitor - Log Analytics and Application Insights
module logAnalytics 'br/public:avm/res/operational-insights/workspace:0.11.1' = {
  name: '${uniqueString(deployment().name, location)}-loganalytics'
  scope: rg
  params: {
    name: !empty(logAnalyticsName) ? logAnalyticsName : '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
    location: location
    tags: tags
    dataRetention: 30
  }
}
 
module monitoring 'br/public:avm/res/insights/component:0.6.0' = {
  name: '${uniqueString(deployment().name, location)}-appinsights'
  scope: rg
  params: {
    name: !empty(applicationInsightsName) ? applicationInsightsName : '${abbrs.insightsComponents}${resourceToken}'
    location: location
    tags: tags
    workspaceResourceId: logAnalytics.outputs.resourceId
     disableLocalAuth: false
  }
}

module eventgridcardtopic 'br/public:avm/res/event-grid/system-topic:0.6.1' = {
  name: 'eventgridcards'
  scope: rg
  params: {
    name: 'unprocessed-cards'
    location: location
    tags: tags
    source: storage.outputs.resourceId
    topicType: 'Microsoft.Storage.StorageAccounts'
  }
} 


// App outputs
output APPLICATIONINSIGHTS_CONNECTION_STRING string = monitoring.outputs.name
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output SERVICE_API_NAME string = api.outputs.SERVICE_API_NAME
output AZURE_FUNCTION_NAME string = api.outputs.SERVICE_API_NAME
output RESOURCE_GROUP string = rg.name
output VISION_NAME string = cog.outputs.visionAccountName
output OPENAI_NAME string = cog.outputs.openAIAccountName
// Cosmos DB Outputs
output COSMOS_CONNECTION__accountEndpoint string = cosmosDb.outputs.cosmosDbAccountEndpoint
output AZURE_COSMOSDB_ACCOUNT_NAME string = cosmosDb.outputs.cosmosDbAccountName
output UNPROCESSED_CARDS_SYSTEM_TOPIC_NAME string = eventgridcardtopic.outputs.name
output UNPROCESSED_CARDS_CONTAINER_NAME string = storageCardsUploadsContainerName 
