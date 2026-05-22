from __future__ import annotations

import time
from typing import Any, Dict, List

from core.decision_model import base_state
from platform_backend.core.runtime import now_text

AGENT_PROBE_HISTORY: List[Dict[str, Any]] = []

def percentile(values: List[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, int(round((pct / 100) * (len(ordered) - 1)))))
    return round(float(ordered[idx]), 2)

def agent_metrics_from_state() -> Dict[str, Any]:
    state = base_state()
    nodes = state.get("nodes", [])
    agent_nodes = [node for node in nodes if "Agent" in str(node.get("name", "")) or node.get("node_id") in {"vision_quality", "localization_3d", "placement_plan", "hardware_interlock", "safety_strategy", "execution_constraint", "fusion_arbitration"}]
    latencies = [float(node.get("latency_ms", 0) or 0) for node in agent_nodes]
    risk_counts: Dict[str, int] = {}
    for node in agent_nodes:
        risk = str(node.get("risk", "UNKNOWN"))
        risk_counts[risk] = risk_counts.get(risk, 0) + 1
    return {
        "agent_count": len(agent_nodes),
        "workflow_node_count": len(nodes),
        "risk_distribution": risk_counts,
        "avg_agent_latency_ms": round(sum(latencies) / len(latencies), 2) if latencies else 0,
        "max_agent_latency_ms": round(max(latencies), 2) if latencies else 0,
        "agent_names": [node.get("name") for node in agent_nodes],
    }

def simulate_agent_decision(scenario: str = "NORMAL", task_type: str = "PICK_AND_PLACE") -> Dict[str, Any]:
    scenario_key = (scenario or "NORMAL").upper()
    started = time.perf_counter()
    base_agents = [
        ("视觉质量Agent", "PASS", "算法输入质量满足决策条件"),
        ("三维定位Agent", "PASS", "目标坐标有效，位姿数据可用于路径规划"),
        ("放置规划Agent", "PASS", "抓取点、放置点与路径规划满足任务约束"),
        ("硬件联锁Agent", "PASS", "安全门、气压、电源和急停状态满足执行条件"),
        ("安全策略Agent", "PASS", "当前风险等级处于可控范围"),
        ("执行约束Agent", "PASS", "机械臂动作未触发越界、超速或扭矩异常"),
    ]
    overrides = {
        "CRC_ERROR": ("硬件联锁Agent", "BLOCKED", "CRC校验异常，控制数据可信度不足"),
        "EMERGENCY_STOP": ("安全策略Agent", "BLOCKED", "急停状态触发，禁止继续执行"),
        "DEVICE_OFFLINE": ("硬件联锁Agent", "BLOCKED", "关键设备离线，控制链路不可用"),
        "LOW_CONFIDENCE": ("视觉质量Agent", "LIMITED", "算法置信度偏低，建议复核后受限执行"),
        "PATH_RISK": ("放置规划Agent", "LIMITED", "路径存在轻微风险，建议限速或调整路径"),
    }
    agents = []
    for name, status, evidence in base_agents:
        if scenario_key in overrides and overrides[scenario_key][0] == name:
            status, evidence = overrides[scenario_key][1], overrides[scenario_key][2]
        agents.append({
            "name": name,
            "status": status,
            "risk": "HIGH" if status == "BLOCKED" else ("MEDIUM" if status == "LIMITED" else "LOW"),
            "evidence": evidence,
        })
    statuses = [item["status"] for item in agents]
    if "BLOCKED" in statuses:
        final_action = "BLOCKED"
        safety_mode = "STOP"
    elif "LIMITED" in statuses:
        final_action = "PICK_AND_PLACE_LIMITED"
        safety_mode = "LIMITED"
    else:
        final_action = "PICK_AND_PLACE"
        safety_mode = "NORMAL"
    elapsed_ms = round((time.perf_counter() - started) * 1000, 3)
    return {
        "probe_id": f"AGT-{time.strftime('%Y%m%d-%H%M%S')}-{len(AGENT_PROBE_HISTORY)+1}",
        "scenario": scenario_key,
        "task_type": task_type,
        "final_action": final_action,
        "safety_mode": safety_mode,
        "agent_results": agents,
        "passed": sum(1 for item in agents if item["status"] == "PASS"),
        "limited": sum(1 for item in agents if item["status"] == "LIMITED"),
        "blocked": sum(1 for item in agents if item["status"] == "BLOCKED"),
        "elapsed_ms": elapsed_ms,
        "timestamp": now_text(),
    }
