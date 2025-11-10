param visionResourceName string
param openAIResourceName string
param openAILocation string = 'swedencentral'
param openAIDeploymentName string = 'gpt-4o-card-descriptions'

resource vision 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: visionResourceName
  location: 'francecentral'
  sku: {
    name: 'S1'
  }
  kind: 'ComputerVision'
  identity: {
    type: 'None'
  }
  properties: {
    customSubDomainName: visionResourceName
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    allowProjectManagement: false
    publicNetworkAccess: 'Enabled'
  }
}


resource openAI 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: openAIResourceName
  location: openAILocation
  sku: {
    name: 'S0'
  }
  kind: 'OpenAI'
  properties: {
    apiProperties: {}
    customSubDomainName: openAIResourceName
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    allowProjectManagement: false
    publicNetworkAccess: 'Enabled'
  }
}


resource openAIDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: openAI
  name: openAIDeploymentName
  sku: {
    name: 'Standard'
    capacity: 50
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o'
      version: '2024-11-20'
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
    currentCapacity: 50
    raiPolicyName: 'Microsoft.DefaultV2'
  }
}





output visionAccountId string = vision.id
output visionAccountName string = vision.name
output visionAccountEndpoint string = vision.properties.endpoint
output openAIAccountId string = openAI.id
output openAIAccountName string = openAI.name
output openAIAccountEndpoint string = openAI.properties.endpoint
output openAIDeploymentName string = openAIDeployment.name
