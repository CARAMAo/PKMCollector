import logging
import os
import azure.functions as func
from utils import vectorize_image_bytes, get_cosmos_container


try:
    from requests_toolbelt.multipart.decoder import MultipartDecoder
except Exception:
    MultipartDecoder = None  # type: ignore


bp = func.Blueprint()

@bp.function_name(name="HttpImageSearch")
@bp.route(route="image-search", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def http_image_search(req: func.HttpRequest) -> func.HttpResponse:
    content_type = req.headers.get('content-type') or req.headers.get('Content-Type') or ''
    if not content_type.lower().startswith('multipart/form-data'):
        return func.HttpResponse(status_code=400, mimetype="application/json", body='{"error":"invalid-content-type"}')

    if MultipartDecoder is None:
        return func.HttpResponse(status_code=500, mimetype="application/json", body='{"error":"multipart-not-available"}')

    try:
        decoder = MultipartDecoder(req.get_body(), content_type)
        file_part = None
        for part in decoder.parts:
            disp = part.headers.get(b"Content-Disposition", b"").decode("utf-8", "ignore")
            if 'filename=' in disp:
                file_part = part
                break
        if file_part is None and decoder.parts:
            file_part = decoder.parts[0]
        image_bytes = file_part.content if file_part else None
        image_ct = None
        if file_part:
            image_ct = file_part.headers.get(b"Content-Type", b"").decode("utf-8", "ignore") or None
    except Exception as e:
        logging.warning('multipart parse failed: %s', e)
        return func.HttpResponse(status_code=400, mimetype="application/json", body='{"error":"invalid-multipart"}')

    if not image_bytes:
        return func.HttpResponse(status_code=400, mimetype="application/json", body='{"error":"missing-file"}')

    vector = vectorize_image_bytes(image_bytes, image_ct)
    if not vector:
        return func.HttpResponse(status_code=502, mimetype="application/json", body='{"error":"vectorization-failed"}')

    try:
        container = get_cosmos_container()
    except Exception as e:
        logging.error('Cosmos init failed: %s', e)
        return func.HttpResponse(status_code=500, mimetype="application/json", body='{"error":"cosmos-init"}')

    cutoff = float(os.environ.get('IMAGE_SEARCH_CUTOFF', '0.8'))

    query = (
        'SELECT TOP 1 VALUE {'
        '  "category": c["category"], '
        '  "id": c["id"], '
        '  "illustrator": c["illustrator"], '
        '  "image": c["image"], '
        '  "localId": c["localId"], '
        '  "name": c["name"], '
        '  "rarity": c["rarity"], '
        '  "set": {'
        '    "id": c["set"]["id"], '
        '    "logo": c["set"]["logo"], '
        '    "name": c["set"]["name"], '
        '    "symbol": c["set"]["symbol"] '
        '  },'
        '  "variants": {'
        '    "firstEdition": c["variants"]["firstEdition"], '
        '    "holo": c["variants"]["holo"], '
        '    "normal": c["variants"]["normal"], '
        '    "reverse": c["variants"]["reverse"], '
        '    "wPromo": c["variants"]["wPromo"] '
        '  }'
        '} '
        'FROM c '
        'WHERE IS_DEFINED(c.imageVector) AND VectorDistance(c.imageVector, @emb) > @cutoff '
        'ORDER BY VectorDistance(c.imageVector, @emb)'
    )

    params = [
        {"name": "@emb", "value": vector},
        {"name": "@cutoff", "value": cutoff},
    ]

    try:
        items = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))
    except Exception as e:
        logging.warning('query failed: %s', e)
        items = []

    import json
    if not items:
        return func.HttpResponse(status_code=200, mimetype="application/json", body=json.dumps([]))

    return func.HttpResponse(status_code=200, mimetype="application/json", body=json.dumps(items))

