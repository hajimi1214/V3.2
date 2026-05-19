from __future__ import annotations

import time
from typing import Dict

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

import platform_backend.services.runtime_docs as docs_service
from platform_backend.core.runtime import SERVER_START_TIME, now_text, platform_runtime_text
from platform_backend.middleware.request_metrics import REQUEST_METRICS
from platform_backend.schemas.test_schemas import AgentProbeRequest, PerformanceProbeRequest
from platform_backend.services.agent_probe import AGENT_PROBE_HISTORY, agent_metrics_from_state, percentile, simulate_agent_decision

router = APIRouter()

@router.get("/api/test/health")
def test_health() -> JSONResponse:
    return JSONResponse({
        "ok": True,
        "service": "智领铜行--人工智能机械臂多Agent智能决策平台",
        "version": "V3.2",
        "uptime_seconds": round(time.time() - SERVER_START_TIME, 2),
        "platform_runtime": platform_runtime_text(),
        "server_time": now_text(),
    })

@router.get("/api/test/runtime-metrics")
def test_runtime_metrics() -> JSONResponse:
    total = int(REQUEST_METRICS["total_requests"])
    avg = round(float(REQUEST_METRICS["total_elapsed_ms"]) / total, 2) if total else 0.0
    routes = []
    for path, stat in REQUEST_METRICS["route_stats"].items():
        count = int(stat["count"])
        routes.append({
            "path": path,
            "count": count,
            "avg_elapsed_ms": round(float(stat["total_elapsed_ms"]) / count, 2) if count else 0.0,
            "max_elapsed_ms": round(float(stat["max_elapsed_ms"]), 2),
            "last_status": stat["last_status"],
        })
    return JSONResponse({
        "ok": True,
        "uptime_seconds": round(time.time() - SERVER_START_TIME, 2),
        "total_requests": total,
        "success_requests": REQUEST_METRICS["success_requests"],
        "error_requests": REQUEST_METRICS["error_requests"],
        "avg_elapsed_ms": avg,
        "max_elapsed_ms": round(float(REQUEST_METRICS["max_elapsed_ms"]), 2),
        "routes": sorted(routes, key=lambda item: item["count"], reverse=True),
    })

@router.get("/api/test/agent-metrics")
def test_agent_metrics() -> JSONResponse:
    metrics = agent_metrics_from_state()
    metrics.update({
        "ok": True,
        "workflow": "PICK_AND_PLACE",
        "arbitration": "SAFETY_FIRST",
        "metric_scope": "Agent节点、风险分布、平均延迟与工作流规模",
        "timestamp": now_text(),
    })
    return JSONResponse(metrics)

@router.post("/api/test/agent-probe")
def test_agent_probe(req: AgentProbeRequest) -> JSONResponse:
    results = [simulate_agent_decision(req.scenario, req.task_type) for _ in range(req.loop_count)]
    AGENT_PROBE_HISTORY.extend(results)
    del AGENT_PROBE_HISTORY[:-50]
    latencies = [item["elapsed_ms"] for item in results]
    final_actions: Dict[str, int] = {}
    for item in results:
        final_actions[item["final_action"]] = final_actions.get(item["final_action"], 0) + 1
    return JSONResponse({
        "ok": True,
        "scenario": req.scenario.upper(),
        "loop_count": req.loop_count,
        "avg_decision_elapsed_ms": round(sum(latencies) / len(latencies), 3) if latencies else 0,
        "max_decision_elapsed_ms": round(max(latencies), 3) if latencies else 0,
        "final_action_distribution": final_actions,
        "latest_result": results[-1] if results else None,
    })

@router.post("/api/test/performance-probe")
def test_performance_probe(req: PerformanceProbeRequest) -> JSONResponse:
    started = time.perf_counter()
    traces = []
    latencies = []
    final_actions: Dict[str, int] = {}
    for _ in range(req.loop_count):
        item = simulate_agent_decision(req.scenario, "PICK_AND_PLACE")
        latencies.append(item["elapsed_ms"])
        final_actions[item["final_action"]] = final_actions.get(item["final_action"], 0) + 1
        if req.include_trace:
            traces.append(item)
    total_elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    throughput = round((req.loop_count / total_elapsed_ms) * 1000, 2) if total_elapsed_ms else req.loop_count
    payload = {
        "ok": True,
        "scenario": req.scenario.upper(),
        "loop_count": req.loop_count,
        "total_elapsed_ms": total_elapsed_ms,
        "throughput_decisions_per_second": throughput,
        "latency_ms": {
            "avg": round(sum(latencies) / len(latencies), 3) if latencies else 0,
            "p50": percentile(latencies, 50),
            "p90": percentile(latencies, 90),
            "p99": percentile(latencies, 99),
            "max": round(max(latencies), 3) if latencies else 0,
        },
        "final_action_distribution": final_actions,
    }
    if req.include_trace:
        payload["traces"] = traces
    return JSONResponse(payload)

@router.get("/api/test/generated-docs")
def test_generated_docs(request: Request) -> JSONResponse:
    host_url = str(request.base_url).rstrip("/")
    return JSONResponse({
        "ok": True,
        "message": "接口文档和测试文档信息已返回，生成时间以文档记录为准",
        "generated_at": docs_service.GENERATED_DOC_AT,
        "batch_id": docs_service.RUNTIME_BATCH_ID,
        "api_address": host_url,
        "api_key": docs_service.API_TEST_KEY,
        "files": docs_service.GENERATED_DOC_FILES,
        "agent_abilities": docs_service.AGENT_ABILITY_TEXT,
        "trace_logs": docs_service.TRACE_LOG_SAMPLE,
    })

@router.get("/api/test/blackbox-suite")
def test_blackbox_suite() -> JSONResponse:
    return JSONResponse({
        "ok": True,
        "description": "提供给测试工程师进行黑盒测试的接口清单",
        "recommended_cases": [
            {"name": "平台健康检查", "method": "GET", "path": "/api/test/health", "expect": "ok=true"},
            {"name": "接口运行指标", "method": "GET", "path": "/api/test/runtime-metrics", "expect": "响应码200，错误请求数可统计"},
            {"name": "Agent指标读取", "method": "GET", "path": "/api/test/agent-metrics", "expect": "返回Agent数量、风险分布、平均延迟"},
            {"name": "正常场景决策探针", "method": "POST", "path": "/api/test/agent-probe", "body": {"scenario": "NORMAL", "loop_count": 1}, "expect": "final_action=PICK_AND_PLACE"},
            {"name": "CRC异常场景", "method": "POST", "path": "/api/test/agent-probe", "body": {"scenario": "CRC_ERROR", "loop_count": 1}, "expect": "final_action=BLOCKED"},
            {"name": "性能探针", "method": "POST", "path": "/api/test/performance-probe", "body": {"scenario": "NORMAL", "loop_count": 100}, "expect": "返回吞吐量和P50/P90/P99延迟"},
            {"name": "指令目标配置", "method": "GET", "path": "/api/command/targets", "expect": "返回上位机控制端地址"},
        ],
    })
