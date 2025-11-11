import logging
import os
import azure.functions as func
from utils import get_cosmos_container
from utils import vectorize_text
import json

bp = func.Blueprint()

@bp.function_name(name="HttpTextSearch")
@bp.route(route="text-search", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def http_text_search(req: func.HttpRequest) -> func.HttpResponse:
    query_text = req.params.get('q')
    if not query_text:
        return func.HttpResponse(status_code=400, mimetype="application/json", body='{"error":"missing-query"}')

    # vector = vectorize_text(query_text)
    # if not vector:
    #     return func.HttpResponse(status_code=502, mimetype="application/json", body='{"error":"vectorization-failed"}')

    try:
        container = get_cosmos_container()
    except Exception as e:
        logging.error('Cosmos init failed: %s', e)
        return func.HttpResponse(status_code=500, mimetype="application/json", body='{"error":"cosmos-init"}')

    # cutoff = float(os.environ.get('TEXT_SEARCH_CUTOFF', '0.65'))

    query = f'''
        SELECT c.id,c.name,c.category,c.illustrator,c.image,c.localId,
                c.rarity,c["set"]
        FROM c 
        WHERE FullTextContainsAll(c.searchText, \"{ '\",\" '.join(query_text.lower().split()) }\")
    '''

    logging.info(f'Text search query: {query}')
    # parameters = [
    #     {"name": "@vector", "value": vector},
    #     {"name": "@cutoff", "value": cutoff}
    # ]

    try:
        items = list(container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))
    except Exception as e:
        logging.error('Cosmos query failed: %s', e)
        return func.HttpResponse(status_code=500, mimetype="application/json", body='{"error":"cosmos-query"}')

    if not items:
        query_vector = vectorize_text(query_text)

        query = f'''
        SELECT TOP 10 c.id,c.name,c.category,c.illustrator,c.image,c.localId,
                c.rarity,c["set"], VectorDistance(c.captionVector, @queryVector) AS score
        FROM c
        ORDER BY VectorDistance(c.captionVector, @queryVector)
        '''
        parameters = [
            {"name": "@queryVector", "value": query_vector}
        ]
        try:
            items = list(container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
        except Exception as e:
            logging.error('Cosmos fallback query failed: %s', e)
            return func.HttpResponse(status_code=500, mimetype="application/json", body='[{"error":"cosmos-query"}]')
        if not items:
            return func.HttpResponse(status_code=404, mimetype="application/json", body='[{"error":"no-match"}]')

   
    return func.HttpResponse(
        status_code=200,
        mimetype="application/json",
        body=json.dumps(items)
    )