from __future__ import annotations

from pydantic import BaseModel, Field

class AgentProbeRequest(BaseModel):
    scenario: str = Field(default="NORMAL", description="测试场景：NORMAL/CRC_ERROR/EMERGENCY_STOP/DEVICE_OFFLINE/LOW_CONFIDENCE/PATH_RISK")
    task_type: str = Field(default="PICK_AND_PLACE", description="任务类型")
    loop_count: int = Field(default=1, ge=1, le=200, description="测试循环次数")

class PerformanceProbeRequest(BaseModel):
    loop_count: int = Field(default=20, ge=1, le=500, description="性能测试循环次数")
    scenario: str = Field(default="NORMAL", description="压测场景")
    include_trace: bool = Field(default=False, description="是否返回每轮Trace明细")
