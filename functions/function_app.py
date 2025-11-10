import azure.functions as func


app = func.FunctionApp()

# Register blueprints
from image_search import bp as image_search_bp  # type: ignore
from cards_trigger import bp as cards_trigger_bp  # type: ignore
from text_search import bp as text_search_bp  # type: ignore

app.register_functions(text_search_bp)
app.register_functions(image_search_bp)
app.register_functions(cards_trigger_bp)
