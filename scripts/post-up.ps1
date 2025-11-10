$commands = @("az")

foreach ($command in $commands) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        Write-Host "Error: $command command is not available, check pre-requisites in README.md"
        exit 1
    }
}

Write-Host "Loading azd .env file from current environment..."
foreach ($line in (& azd env get-values)) {
    if ($line -match "([^=]+)=(.*)") {
        $key = $matches[1]
        $value = $matches[2].Trim('"')
        [Environment]::SetEnvironmentVariable($key, $value)
    }
}

$blobsExtension = az functionapp keys list `
    -n $env:AZURE_FUNCTION_NAME `
    -g $env:RESOURCE_GROUP `
    --query "systemKeys.blobs_extension" `
    -o tsv

$endpointUrl = "https://$($env:AZURE_FUNCTION_NAME).azurewebsites.net/runtime/webhooks/blobs?functionName=Host.Functions.index_cards&code=$blobsExtension"
$filter = "/blobServices/default/containers/$($env:UNPROCESSED_CARDS_CONTAINER_NAME)"

az eventgrid system-topic event-subscription create `
    -n "unprocessed-cards-topic-subscription" `
    -g $env:RESOURCE_GROUP `
    --system-topic-name $env:UNPROCESSED_CARDS_SYSTEM_TOPIC_NAME `
    --endpoint-type "webhook" `
    --endpoint $endpointUrl `
    --included-event-types "Microsoft.Storage.BlobCreated" `
    --subject-begins-with $filter `
    --subject-ends-with ".json" `
    --subject-case-sensitive false

Write-Output "Created blob event grid subscription successfully."
