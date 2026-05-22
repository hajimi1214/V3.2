from __future__ import annotations

import asyncio
import json
import time

from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from core.decision_model import DECISION_STEPS, base_state, with_agent_work
from platform_backend.config.paths import STATIC_DIR
from platform_backend.core.runtime import platform_runtime_text

router = APIRouter()

@router.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")

@router.get("/api/meta")
def meta() -> JSONResponse:
    state = base_state()
    state["runtime"] = platform_runtime_text()
    state["server_time"] = time.strftime("%Y-%m-%d %H:%M:%S")
    return JSONResponse(state)

@router.get("/api/decision/stream")
async def decision_stream(delay: float = 2.35) -> StreamingResponse:
    async def event_generator():
        for i, step in enumerate(DECISION_STEPS, start=1):
            payload = {"index": i, "ts": time.strftime("%H:%M:%S"), **with_agent_work(step)}
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
            await asyncio.sleep(delay)
        yield f"data: {json.dumps({'done': True, 'ts': time.strftime('%H:%M:%S')}, ensure_ascii=False)}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/api/state")
def state() -> JSONResponse:
    return JSONResponse(base_state())
