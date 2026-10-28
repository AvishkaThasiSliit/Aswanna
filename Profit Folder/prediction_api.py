"""
Alias entrypoint so `uvicorn prediction_api:app` works from workspace root.
Redirects to the unified multi-engine FastAPI service in profit_engine.api.
"""
from profit_engine.api import app

__all__ = ["app"]
