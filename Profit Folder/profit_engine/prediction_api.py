"""
Alias entrypoint so `uvicorn prediction_api:app` works from profit_engine directory.
Redirects to the unified multi-engine FastAPI service in profit_engine.api.
"""
import sys
from pathlib import Path

# Ensure root is in path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from profit_engine.api import app

__all__ = ["app"]
