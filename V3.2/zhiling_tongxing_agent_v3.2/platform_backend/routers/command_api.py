from __future__ import annotations

import asyncio
import time
from typing import Dict, List

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from platform_backend.schemas.command_schemas import CommandDispatchRequest
from platform_backend.services.command_dispatch import load_command_targets, send_control_signal_to_target

router = APIRouter()

@router.get("/api/command/targets")
def command_targets() -> JSONResponse:
    config = load_command_targets()
    return JSONResponse({
        "ok": True,
        "targets": config.get("targets", []),
        "timeout_seconds": config.get("timeout_seconds", 3.0),
        "protocol": config.get("protocol", "tcp_plain"),
    })

@router.post("/api/command/dispatch")
async def command_dispatch(req: CommandDispatchRequest) -> JSONResponse:
    config = load_command_targets()
    targets: List[Dict[str, str]] = config.get("targets", [])
    timeout = float(config.get("timeout_seconds", 3.0) or 3.0)
    if not targets:
        return JSONResponse({"ok": False, "message": "未维护上位机控制端地址", "results": []}, status_code=400)
    dispatch_payload = {
        "source": "智领铜行--人工智能机械臂多Agent智能决策平台",
        "version": "V3.2",
        "dispatch_id": f"CMD-{time.strftime('%Y%m%d-%H%M%S')}",
        "command": req.command,
        "message": req.message,
        "payload": req.payload,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    _ = dispatch_payload
    results = await asyncio.gather(*[
        asyncio.to_thread(send_control_signal_to_target, target, timeout)
        for target in targets
    ])
    success_count = sum(1 for item in results if item.get("ok"))
    return JSONResponse({
        "ok": success_count == len(targets),
        "success_count": success_count,
        "target_count": len(targets),
        "protocol": "tcp_plain",
        "message": "决策控制指令已下发" if success_count == len(targets) else "控制链路未全部确认",
        "results": results,
    })
