from __future__ import annotations

from typing import Any, Dict

from pydantic import BaseModel, Field

class CommandDispatchRequest(BaseModel):
    command: str = Field(default="CONTROL_TASK_DISPATCH", description="控制指令名称")
    message: str = Field(default="决策控制指令下发", description="控制指令说明")
    payload: Dict[str, Any] = Field(default_factory=dict, description="附加业务数据")
