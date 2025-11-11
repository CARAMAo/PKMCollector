import logging
import os
import json
import requests
from azure.cosmos import CosmosClient


def vectorize_image(url: str) -> list[float] | None:
    endpoint = os.environ.get('AZURE_VISION_ENDPOINT', '').rstrip('/')
    key = os.environ.get('AZURE_VISION_KEY')
    api_version = os.environ.get('AZURE_VISION_API_VERSION', '2024-02-01')
    model_version = '2022-04-11'

    if not endpoint or not key:
        logging.error('Vision not configured (AZURE_VISION_ENDPOINT/AZURE_VISION_KEY)')
        return None

    url_ep = f"{endpoint}/computervision/retrieval:vectorizeImage?model-version={model_version}&api-version={api_version}"
    headers = {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': key,
    }
    try:
        resp = requests.post(url_ep, headers=headers, json={'url': url}, timeout=30)
        if resp.status_code >= 400:
            logging.warning('Vision error %s: %s', resp.status_code, resp.text)
            return None
        data = resp.json()
        return data.get('vector')
    except Exception as e:
        logging.exception('Vision request failed: %s', e)
        return None

def vectorize_text(text: str) -> list[float] | None:
    endpoint = os.environ.get('AZURE_OPENAI_ENDPOINT', '').rstrip('/')
    key = os.environ.get('AZURE_OPENAI_API_KEY')
    api_version = os.environ.get('AZURE_OPENAI_EMBEDDING_API_VERSION', '2023-05-15')

    if not endpoint or not key:
        logging.error('TEXT embedding not configured (AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_EMBEDDING_KEY)')
        return None

    url_ep = f"{endpoint}/openai/deployments/text-embedding-ada-002/embeddings?api-version={api_version}"
    headers = {
        'Content-Type': 'application/json',
        'api-key': key,
    }
    try:
        resp = requests.post(url_ep, headers=headers, json={'input': text}, timeout=30)
        if resp.status_code >= 400:
            logging.warning('Embedding error %s: %s', resp.status_code, resp.text)
            return None
        data = resp.json()
        return data.get('data',[])[0].get('embedding')
    except Exception as e:
        logging.exception('Embedding request failed: %s', e)
        return None

def vectorize_image_bytes(data: bytes, content_type: str | None = None) -> list[float] | None:
    endpoint = os.environ.get('AZURE_VISION_ENDPOINT', '').rstrip('/')
    key = os.environ.get('AZURE_VISION_KEY')
    api_version = os.environ.get('AZURE_VISION_API_VERSION', '2024-02-01')
    model_version = '2022-04-11'

    if not endpoint or not key:
        logging.error('Vision not configured (AZURE_VISION_ENDPOINT/AZURE_VISION_KEY)')
        return None

    url_ep = f"{endpoint}/computervision/retrieval:vectorizeImage?model-version={model_version}&api-version={api_version}"
    headers = {
        'Content-Type': content_type or 'application/octet-stream',
        'Ocp-Apim-Subscription-Key': key,
    }
    try:
        resp = requests.post(url_ep, headers=headers, data=data, timeout=30)
        if resp.status_code >= 400:
            logging.warning('Vision error %s: %s', resp.status_code, resp.text)
            return None
        payload = resp.json()
        return payload.get('vector')
    except Exception as e:
        logging.exception('Vision request failed: %s', e)
        return None


def get_cosmos_container():
    cs = (
        os.environ.get('COSMOS_CONNECTION')
        or os.environ.get('COSMOS_CONNECTION_STRING')
    )
    if not cs:
        raise RuntimeError('COSMOS_CONNECTION (or COSMOS_CONNECTION_STRING) is not set')

    client = CosmosClient.from_connection_string(cs)

    db_name = os.environ.get('COSMOS_DB_NAME', 'pkmcollector-db')
    container_name = os.environ.get('COSMOS_CARDS_CONTAINER_NAME', 'cards')
    db = client.get_database_client(db_name)
    return db.get_container_client(container_name)


def openai_caption_card_image(card_image_url: str) -> str | None:
    try:
        from openai import AzureOpenAI
    except Exception as e:
        logging.error('OpenAI SDK import failed: %s', e)
        return None

    endpoint = (os.environ.get('AZURE_OPENAI_ENDPOINT', '') or '').rstrip('/')
    key = os.environ.get('AZURE_OPENAI_API_KEY') or os.environ.get('AZURE_OPENAI_KEY')
    api_version = os.environ.get('AZURE_OPENAI_API_VERSION', '2024-10-21')
    deployment = os.environ.get('AZURE_OPENAI_DEPLOYMENT', 'gpt-4o-card-descriptions')

    if not endpoint or not key:
        logging.error('Azure OpenAI not configured (AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY)')
        return None

    system_prompt = (
        'Describe Pokémon TCG card artwork for semantic search. Decribe the scene in the card Artwork, mentioning Pokemons, what they\'re doing, interactions, and the location they\'re in. '
        'ONLY Return a JSON with a single key "description" {"description: "..."}'
        'Describe the elements of the card that a person could remember to describe the card, in simple language, in order to allow effective semantic search.'
        'Return empty description property {"description":""} if the image is not a Pokémon TCG card artwork or you cannot access the image.'
        'Return an empty description for simple items, energy cards, or cards without full artwork (the artwork does not cover the entire card)'
    )

    client = AzureOpenAI(azure_endpoint=endpoint, api_key=key, api_version=api_version)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": [{"type": "image_url", "image_url": {"url": card_image_url}}]},
    ]
    try:
        completion = client.chat.completions.create(model=deployment, messages=messages, temperature=0.6, max_tokens=6553)
        content = completion.choices[0].message.content
        if not content:
            return None
        try:
            data = json.loads(content)
        except Exception:
            return None
        description = data.get('description') if isinstance(data, dict) else None
        return description if isinstance(description, str) and description.strip() else None
    except Exception as e:
        logging.warning('OpenAI caption failed: %s', e)
        return None
