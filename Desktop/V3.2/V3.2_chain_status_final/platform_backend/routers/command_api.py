from __future__ import annotations

import asyncio
import time
from typing import Dict, List

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from platform_backend.schemas.command_schemas import CommandDispatchRequest
from platform_backend.services.command_dispatch import (
    load_command_targets,
    send_control_signal_to_target,
)

router = APIRouter()


@router.get("/api/command/targets")
def command_targets() -> JSONResponse:
    config = load_command_targets()

    # 这里只展示两个上位机
    targets = list(config.get("targets", []))[:2]

    return JSONResponse({
        "ok": True,
        "targets": targets,
        "timeout_seconds": config.get("timeout_seconds", 3.0),
        "protocol": config.get("protocol", "tcp_plain"),
    })


@router.post("/api/command/dispatch")
async def command_dispatch(req: CommandDispatchRequest) -> JSONResponse:
    config = load_command_targets()

    # 这里只给两个上位机下发
    targets: List[Dict[str, str]] = list(config.get("targets", []))[:2]

    timeout = float(config.get("timeout_seconds", 3.0) or 3.0)

    if not targets:
        return JSONResponse(
            {
                "ok": False,
                "message": "未维护上位机控制端地址",
                "results": []
            },
            status_code=400
        )

    dispatch_id = f"CMD-{time.strftime('%Y%m%d-%H%M%S')}"

    results = await asyncio.gather(*[
        asyncio.to_thread(
            send_control_signal_to_target,
            target,
            timeout
        )
        for target in targets
    ])

    success_count = sum(1 for item in results if item.get("ok"))
    all_success = success_count == len(targets)

    return JSONResponse({
        "ok": all_success,
        "dispatch_id": dispatch_id,
        "success_count": success_count,
        "target_count": len(targets),
        "protocol": "tcp_plain",
        "message": "OK指令已发送至两个上位机控制端" if all_success else "部分上位机未完成OK指令发送",
        "results": results,
    })