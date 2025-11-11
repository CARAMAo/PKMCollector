import logging
import os
import json
import azure.functions as func
import azurefunctions.extensions.bindings.blob as blob

from utils import vectorize_image, get_cosmos_container,vectorize_text
from utils import openai_caption_card_image

bp = func.Blueprint()


@bp.blob_trigger(
    arg_name="cards_blob",
    source=func.BlobSource.EVENT_GRID,
    path=os.environ.get('AZURE_STORAGE_CARDS_UPLOADS_CONTAINER_NAME'),
    connection="AzureWebJobsStorage",
)
def index_cards(cards_blob: blob.BlobClient) -> None:
    try:
        props = cards_blob.get_blob_properties()
        blob_name = props.name if hasattr(props, 'name') else getattr(cards_blob, 'blob_name', '')
    except Exception:
        blob_name = ''

    logging.info('Cards Blob Trigger fired for blob: %s', blob_name or '(unknown)')

    # read blob
    try:
        downloader = cards_blob.download_blob()
        payload = downloader.readall()
    except Exception as e:
        logging.error('Failed to read blob %s: %s', blob_name, e)
        return

    # parse
    try:
        data = json.loads(payload.decode('utf-8', 'ignore'))
    except Exception as e:
        logging.error('Invalid JSON in blob %s: %s', blob_name, e)
        return

    if not isinstance(data, list):
        logging.warning('Expected an array of cards in %s; got %s', blob_name, type(data).__name__)
        return

    # filter valid cards
    cards: list[dict] = []
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            logging.warning('Skipping non-object at index %d in %s', i, blob_name)
            continue
        if not item.get('id'):
            logging.warning('Skipping item without id at index %d in %s', i, blob_name)
            continue
        cards.append(item)

    if not cards:
        logging.info('No new cards to index from %s', blob_name)
        return

    try:
        container = get_cosmos_container()
    except Exception as e:
        logging.error('Cosmos init failed: %s', e)
        return

    for card in cards:
        try:
            card_id = card.get('id')
            logging.info('Indexing card: %s', card_id)

            
            # builds searchText for keyword search
            try:
                set_name = (card.get('set') or {}).get('name') or ''
            except Exception:
                set_name = ''

            parts = [
                card.get('category') or '',
                card.get('name') or '',
                card.get('illustrator') or '',
                card.get('rarity') or '',
                set_name,
            ]
            search_text = ' '.join([p for p in parts if p]).strip()
            if not search_text:
                logging.info('card %s has no searchText components', card_id)
                continue
            
            card['searchText'] = search_text

            
            img = card.get('image')
            if img:
                vec = vectorize_image(img)
                if vec:
                    card['imageVector'] = vec
                    logging.info('computed imageVector for %s', card_id)
                else:
                    logging.info('vectorization failed for %s', card_id)
            else:
                logging.info('card %s has no image, skipping vectorization', card_id)
                continue

            
            try:
                img_url = card.get('image')

                desc = openai_caption_card_image(img_url)
                if desc:
                    card['caption'] = desc
                    logging.info(desc)
                    card['captionVector'] = vectorize_text(desc)
                    logging.info('computed caption and embedding for %s', card_id)
                else:
                    logging.info('no captioning for %s', card_id)
            
            except Exception as e:
                logging.warning('captioning failed for %s: %s', card_id, e)

            container.upsert_item(card)
            logging.info('upserted card %s with updates', card_id)

        except Exception as e:
            logging.warning('update failed: %s', e)
    cards_blob.delete_blob()
    logging.info('Completed indexing cards from blob: %s', blob_name)  