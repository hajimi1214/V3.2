from __future__ import annotations

import os
import secrets
import time
from pathlib import Path
from typing import Dict

from platform_backend.config.paths import BASE_DIR, DOCS_DIR

PLATFORM_NAME = "智领铜行--人工智能机械臂多Agent智能决策平台"
PLATFORM_VERSION = "V3.2"
API_TEST_KEY = os.getenv("AGENT_TEST_API_KEY") or ("zltx_live_sk_v3_2_" + secrets.token_urlsafe(48).replace("-", "_").replace("=", ""))
RUNTIME_BATCH_ID = ""
GENERATED_DOC_AT = ""
GENERATED_DOC_FILES: Dict[str, str] = {}

AGENT_ABILITY_TEXT = [
    "视觉质量Agent：校验图像修复结果、YOLO识别置信度、目标完整性和遮挡风险。",
    "三维定位Agent：读取双目测距结果，判断目标坐标、深度距离和抓取位姿是否有效。",
    "放置规划Agent：校验抓取点、放置点、AGV放置位和路径可行性。",
    "硬件联锁Agent：检查安全门、光栅、急停、气压、电源和PLC联锁链。",
    "安全策略Agent：根据设备状态、风险等级和权限矩阵判断是否允许执行。",
    "执行约束Agent：检查机械臂关节、速度、负载、扭矩和运动边界。",
    "融合仲裁Agent：综合各Agent输出，生成最终控制任务和执行策略。",
]

TRACE_LOG_SAMPLE = [
    "[视觉质量Agent] 图像修复结果可用，YOLO目标置信度0.98，铜箔卷目标进入定位流程。",
    "[三维定位Agent] 双目测距坐标有效，目标中心点与机械臂基坐标转换完成。",
    "[放置规划Agent] 抓取点、放置点和AGV放置位通过路径规划校验。",
    "[硬件联锁Agent] 安全门、光栅、急停、气压、电源状态满足执行条件。",
    "[安全策略Agent] 当前风险等级LOW，动作权限矩阵允许执行PICK_AND_PLACE。",
    "[执行约束Agent] 关节限位、速度边界和末端负载校验通过。",
    "[融合仲裁Agent] 多Agent审查通过，控制任务进入上位机下发阶段。",
]

def _doc_paths() -> Dict[str, Path]:
    return {
        "interface_doc": DOCS_DIR / "接口文档.md",
        "api_test_doc": DOCS_DIR / "测试文档.md",
        "test_cases": DOCS_DIR / "测试用例.csv",
    }

def _interface_doc(now: str, batch_id: str, api_key: str) -> str:
    return f"""# 接口文档

## 1. 文档说明

本文档面向测试工程师、联调工程师和自研测试平台，用于明确接口地址、鉴权方式、请求格式、响应字段和接口边界。文档刷新开关可在后端入口中按需启用。

| 项目 | 内容 |
|---|---|
| 平台名称 | {PLATFORM_NAME} |
| 平台版本 | {PLATFORM_VERSION} |
| 生成时间 | {now} |
| 启动批次 | {batch_id} |
| 本机 API 地址 | `http://127.0.0.1:7860` |
| 局域网 API 地址 | `http://<平台主机IP>:7860` |
| API 密钥 | `{api_key}` |
| 数据格式 | JSON |

## 2. 鉴权与请求头

```http
Content-Type: application/json
X-Agent-Test-Key: {api_key}
X-Agent-Trace-Mode: ENABLED
```

## 3. 接口清单

### 3.1 平台健康检查
- 方法：`GET`
- 路径：`/api/test/health`
- 作用：检查平台服务、版本、运行时长和服务器时间。
- 期望：HTTP 200，`ok=true`。

### 3.2 运行指标读取
- 方法：`GET`
- 路径：`/api/test/runtime-metrics`
- 作用：读取总请求数、成功数、异常数、平均响应时间和最大响应时间。
- 期望：HTTP 200，返回接口运行指标。

### 3.3 Agent 指标读取
- 方法：`GET`
- 路径：`/api/test/agent-metrics`
- 作用：读取 Agent 数量、风险分布、仲裁策略和平均延迟。
- 期望：HTTP 200，返回多 Agent 决策指标。

### 3.4 Agent 决策探针
- 方法：`POST`
- 路径：`/api/test/agent-probe`
- 请求体示例：`{{"scenario":"NORMAL","loop_count":1}}`
- 作用：模拟正常、CRC异常、急停、设备离线、路径风险等场景。
- 期望：正常场景返回 `PICK_AND_PLACE`，异常场景返回 `BLOCKED` 或受限执行。

### 3.5 性能探针
- 方法：`POST`
- 路径：`/api/test/performance-probe`
- 请求体示例：`{{"scenario":"NORMAL","loop_count":100,"include_trace":false}}`
- 作用：统计多 Agent 决策吞吐量和 P50/P90/P99 延迟。
- 期望：HTTP 200，返回性能指标。

### 3.6 上位机目标配置
- 方法：`GET`
- 路径：`/api/command/targets`
- 作用：读取当前指令下发目标地址、端口和协议配置。
- 期望：HTTP 200，返回上位机控制端配置。

### 3.7 决策控制指令下发
- 方法：`POST`
- 路径：`/api/command/dispatch`
- 作用：向上位机控制端下发经 Agent 仲裁后的控制任务。
- 期望：仅在 Agent 总线完成后允许下发，异常场景应被前端或服务端拦截。
"""

def _test_doc(now: str, batch_id: str, api_key: str) -> str:
    abilities = "\n".join(f"- {item}" for item in AGENT_ABILITY_TEXT)
    traces = "\n".join(f"- {item}" for item in TRACE_LOG_SAMPLE)
    return f"""# 测试文档

## 1. 测试目标

本文档面向测试工程师，用于对 {PLATFORM_NAME} 进行 API 测试、性能验证、异常场景验证和 Trace 复核。

| 项目 | 内容 |
|---|---|
| 平台版本 | {PLATFORM_VERSION} |
| 生成时间 | {now} |
| 启动批次 | {batch_id} |
| API 地址 | `http://127.0.0.1:7860` / `http://<平台主机IP>:7860` |
| API 密钥 | `{api_key}` |
| 建议工具 | JMeter、Postman、Apifox、自研测试平台 |

## 2. API 测试密钥

- 请求头名称：`X-Agent-Test-Key`
- 当前运行密钥：`{api_key}`
- 密钥用途：用于区分测试批次、接口调用来源和测试报告归档。

## 3. Agent 能力说明

{abilities}

## 4. Trace 日志关注点

{traces}

## 5. 异常场景覆盖

- CRC_ERROR：确认硬件联锁 Agent 阻断。
- EMERGENCY_STOP：确认安全策略 Agent 阻断。
- DEVICE_OFFLINE：确认设备链路不可下发。
- PATH_RISK：确认放置规划 Agent 给出受限执行策略。
- 未完成 Agent 仲裁直接下发：确认前端弹出“Agent仲裁未完成”并终止请求。
"""

def _test_cases(api_key: str) -> str:
    rows = [
        ["TC-001","平台健康检查","GET","/api/test/health","http://127.0.0.1:7860",api_key,"","HTTP 200 且 ok=true","10线程x10次","记录服务版本和运行时间"],
        ["TC-002","运行指标读取","GET","/api/test/runtime-metrics","http://127.0.0.1:7860",api_key,"","返回请求量和响应时间指标","10线程x10次","观察错误数是否异常增长"],
        ["TC-003","Agent指标读取","GET","/api/test/agent-metrics","http://127.0.0.1:7860",api_key,"","返回Agent数量和仲裁策略","10线程x10次","确认Agent能力指标完整"],
        ["TC-004","正常场景决策探针","POST","/api/test/agent-probe","http://127.0.0.1:7860",api_key,'{"scenario":"NORMAL","loop_count":1}',"返回PICK_AND_PLACE","5线程x10次","确认视觉/定位/规划/联锁依次通过"],
        ["TC-005","CRC异常场景探针","POST","/api/test/agent-probe","http://127.0.0.1:7860",api_key,'{"scenario":"CRC_ERROR","loop_count":1}',"返回BLOCKED","5线程x10次","确认硬件联锁Agent阻断"],
        ["TC-006","急停场景探针","POST","/api/test/agent-probe","http://127.0.0.1:7860",api_key,'{"scenario":"EMERGENCY_STOP","loop_count":1}',"返回BLOCKED","5线程x10次","确认安全策略Agent阻断"],
        ["TC-007","设备离线场景探针","POST","/api/test/agent-probe","http://127.0.0.1:7860",api_key,'{"scenario":"DEVICE_OFFLINE","loop_count":1}',"返回BLOCKED","5线程x10次","确认设备链路不可下发"],
        ["TC-008","路径风险场景探针","POST","/api/test/agent-probe","http://127.0.0.1:7860",api_key,'{"scenario":"PATH_RISK","loop_count":1}',"返回LIMITED或受限执行","5线程x10次","确认放置规划Agent给出受限策略"],
        ["TC-009","性能探针","POST","/api/test/performance-probe","http://127.0.0.1:7860",api_key,'{"scenario":"NORMAL","loop_count":100,"include_trace":false}',"返回吞吐量和P50/P90/P99","1线程x1次","记录性能报告"],
        ["TC-010","上位机目标配置","GET","/api/command/targets","http://127.0.0.1:7860",api_key,"","返回上位机控制端配置","1线程x1次","确认目标地址和端口"],
        ["TC-011","决策控制指令下发","POST","/api/command/dispatch","http://127.0.0.1:7860",api_key,'{"source":"test_engineer","taskType":"PICK_AND_PLACE"}',"单次链路验证，不做并发","1线程x1次","确认Agent仲裁完成后才允许下发"],
    ]
    def cell(value: str) -> str:
        value = str(value)
        if any(ch in value for ch in [',','"','\n']):
            return '"' + value.replace('"','""') + '"'
        return value
    header = ["用例编号","用例名称","方法","接口路径","API地址","API密钥","请求体","期望结果","建议并发","Trace关注点"]
    return "\n".join(",".join(cell(x) for x in row) for row in [header, *rows]) + "\n"

def ensure_runtime_test_docs() -> Dict[str, str]:
    """Regenerate one interface doc, one test doc, and one test case file on each platform run."""
    global RUNTIME_BATCH_ID, GENERATED_DOC_AT, GENERATED_DOC_FILES
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    RUNTIME_BATCH_ID = f"ZLTX-RUN-{time.strftime('%Y%m%d-%H%M%S')}"
    paths = _doc_paths()
    aliases = {
        "工业级平台接口文档.md", "工业级平台API测试文档.md", "工业级平台API测试用例.csv",
        "接口文档.md", "测试文档.md", "测试用例.csv",
        "#U63a5#U53e3#U6587#U6863.md", "#U6d4b#U8bd5#U6587#U6863.md", "#U6d4b#U8bd5#U7528#U4f8b.csv",
    }
    for item in DOCS_DIR.iterdir():
        if item.is_file() and (item.name in aliases or "#U" in item.name or any(bad in item.name for bad in ["\u93ba", "\u5a34", "\u93c2", "\u9422"])):
            item.unlink(missing_ok=True)
    paths["interface_doc"].write_text(_interface_doc(now, RUNTIME_BATCH_ID, API_TEST_KEY), encoding="utf-8-sig")
    paths["api_test_doc"].write_text(_test_doc(now, RUNTIME_BATCH_ID, API_TEST_KEY), encoding="utf-8-sig")
    paths["test_cases"].write_text(_test_cases(API_TEST_KEY), encoding="utf-8-sig")
    GENERATED_DOC_AT = now
    GENERATED_DOC_FILES = {key: str(path.relative_to(BASE_DIR)) for key, path in paths.items()}
    return GENERATED_DOC_FILES
