from __future__ import annotations

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from platform_backend.config.paths import STATIC_DIR
from platform_backend.middleware.request_metrics import collect_request_metrics
from platform_backend.routers.command_api import router as command_router
from platform_backend.routers.page_api import router as page_router
from platform_backend.routers.test_api import router as test_router
from platform_backend.services.runtime_docs import ensure_runtime_test_docs

def create_app() -> FastAPI:
    #ensure_runtime_test_docs()
    app = FastAPI(title="智领铜行--人工智能机械臂多Agent智能决策平台", version="V3.2")
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    app.middleware("http")(collect_request_metrics)
    app.include_router(test_router)
    app.include_router(command_router)
    app.include_router(page_router)
    return app
