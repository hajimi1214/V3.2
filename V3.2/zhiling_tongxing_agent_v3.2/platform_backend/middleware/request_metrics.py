from __future__ import annotations

import time
from typing import Any, Dict

from fastapi import Request

REQUEST_METRICS: Dict[str, Any] = {
    "total_requests": 0,
    "success_requests": 0,
    "error_requests": 0,
    "total_elapsed_ms": 0.0,
    "max_elapsed_ms": 0.0,
    "route_stats": {},
}

async def collect_request_metrics(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - started) * 1000, 3)
    path = request.url.path
    REQUEST_METRICS["total_requests"] += 1
    REQUEST_METRICS["total_elapsed_ms"] += elapsed_ms
    REQUEST_METRICS["max_elapsed_ms"] = max(float(REQUEST_METRICS["max_elapsed_ms"]), elapsed_ms)
    if response.status_code < 400:
        REQUEST_METRICS["success_requests"] += 1
    else:
        REQUEST_METRICS["error_requests"] += 1
    route_stats = REQUEST_METRICS["route_stats"].setdefault(path, {"count": 0, "total_elapsed_ms": 0.0, "max_elapsed_ms": 0.0, "last_status": 0})
    route_stats["count"] += 1
    route_stats["total_elapsed_ms"] += elapsed_ms
    route_stats["max_elapsed_ms"] = max(float(route_stats["max_elapsed_ms"]), elapsed_ms)
    route_stats["last_status"] = response.status_code
    response.headers["X-Agent-Platform-Elapsed-Ms"] = str(elapsed_ms)
    return response
