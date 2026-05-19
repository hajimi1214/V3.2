from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, List


@dataclass
class AgentNode:
    node_id: str
    name: str
    role: str
    layer: str
    status: str
    input_summary: str
    evidence: str
    output: str
    risk: str
    latency_ms: int
    icon: str

    def to_dict(self) -> Dict:
        return asdict(self)


INITIAL_NODES: List[AgentNode] = [
    AgentNode("state_capture", "工业状态帧采集", "状态帧触发 · 非人工指定", "输入层", "DONE", "双目相机+AGV视觉+硬件联锁", "CAMERA_FRAME_1245", "状态帧已采集", "LOW", 12, "▣"),
    AgentNode("context_model", "任务上下文建模 / 流程规划", "场景理解 · 任务分析 · 流程拆解", "规划层", "DONE", "铜箔卷抓取任务", "TASK_CONTEXT_001", "流程已拆解", "LOW", 18, "⌘"),
    AgentNode("vision_quality", "视觉质量Agent", "视觉质量审查", "专家并审层", "PASS", "相机帧#1245", "2D检测置信度0.98", "视觉质量合格", "LOW", 46, "◉"),
    AgentNode("localization_3d", "三维定位Agent", "三维定位审查", "专家并审层", "PASS", "点云#0891", "定位RMSE 0.21mm", "定位精度达标", "LOW", 98, "◇"),
    AgentNode("placement_plan", "放置规划Agent", "放置点与路径规划", "专家并审层", "RUNNING", "工件姿态+目标位", "路径可行率92%", "规划中，第3候选路径", "MEDIUM", 312, "◎"),
    AgentNode("hardware_interlock", "硬件联锁Agent", "PLC / I-O / 安全门联锁", "专家并审层", "LIMITED", "I/O状态+联锁链", "安全门延时确认", "降级策略可行", "MEDIUM", 127, "▣"),
    AgentNode("safety_strategy", "安全策略Agent", "安全策略审查", "专家并审层", "PASS", "风险评估请求", "策略匹配置信0.95", "风险可控", "LOW", 88, "◈"),
    AgentNode("execution_constraint", "执行约束Agent", "执行边界审查", "专家并审层", "BLOCKED", "机器人关节预检", "关节J2扭矩接近上限", "执行受阻，需限速", "HIGH", 64, "⌁"),
    AgentNode("fusion_arbitration", "融合仲裁 / 最终仲裁Agent", "综合评估 · 权重投票 · 决策仲裁", "仲裁层", "WAITING", "专家Agent结果集合", "6路审查结论", "等待融合仲裁", "MEDIUM", 0, "⚖"),
    AgentNode("control_task", "控制任务生成", "动作序列 · 权限校验 · 指令生成", "控制层", "WAITING", "仲裁动作建议", "动作权限矩阵", "等待生成控制任务", "MEDIUM", 0, "⚙"),
    AgentNode("archive", "报告归档", "结果归档 · 证据固存 · 可追溯", "归档层", "WAITING", "任务执行结果", "证据链/Trace", "等待归档", "LOW", 0, "▤"),
]


def base_state() -> Dict:
    return {
        "platform": "智领铜行--人工智能机械臂多Agent智能决策平台",
        "version": "V3.2 Industrial Workflow",
        "frame_id": "FRM-20260509-001245",
        "decision_id": "DEC-20260509-00187",
        "current_task": "PICK_AND_PLACE",
        "runtime": "72天 00:00:00",
        "risk_profile": "LOW_RISK",
        "focus_node": "state_capture",
        "nodes": [dict(node.to_dict(), status=("WAITING" if node.node_id != "state_capture" else "WAITING")) for node in INITIAL_NODES],
        "summary": {
            "total_agents": 6,
            "passed": 0,
            "limited": 0,
            "blocked": 0,
            "running": 0,
            "consensus": "待生成",
            "risk_synthesis": "UNKNOWN",
            "final_action": "WAITING_FOR_STATE_FRAME",
        },
    }


AGENT_WORK_MAP = {
    "工业状态帧采集": [
        "读取双目相机帧、AGV视觉帧和PLC联锁字段",
        "执行CRC校验、急停状态确认和设备在线检查",
        "封装标准工业状态帧并推送给任务建模Agent",
    ],
    "任务上下文建模Agent": [
        "解析铜箔卷抓取任务、AGV放置点和机械臂工况",
        "将任务拆解为视觉、定位、规划、联锁、安全、执行约束六路审查",
        "生成多Agent并行审查上下文和流程依赖关系",
    ],
    "视觉质量Agent": [
        "读取图像修复结果和YOLO铜箔检测框",
        "校验置信度、遮挡率、目标完整性和图像质量",
        "输出视觉输入是否可进入后续定位与抓取规划",
    ],
    "三维定位Agent": [
        "读取SGBM深度图和点云ROI",
        "计算目标三维位姿、Z轴距离和定位RMSE",
        "判断抓取深度与机械臂可达性是否满足条件",
    ],
    "放置规划Agent": [
        "读取目标位姿、AGV放置坐标和工件姿态",
        "调用IK Solver生成候选机械臂轨迹",
        "执行碰撞检测、路径代价评估和限速策略判断",
    ],
    "硬件联锁Agent": [
        "读取PLC I/O、光栅、安全门、气压和电源状态",
        "校验联锁链是否闭合以及安全门延时确认结果",
        "给出ALLOW/LIMITED/BLOCK硬件放行建议",
    ],
    "执行约束Agent": [
        "检查关节扭矩、末端负载和速度边界",
        "判断J2关节扭矩裕度是否满足原速执行",
        "输出限速、重新规划或阻断执行建议",
    ],
    "融合仲裁 / 最终仲裁Agent": [
        "收集六路专家Agent审查结果和证据链",
        "执行权重投票、安全否决和冲突消解",
        "生成最终动作建议和风险合成结论",
    ],
}


def with_agent_work(step: Dict) -> Dict:
    """Return a shallow-copied event step with explicit agent work details for UI display."""
    copied = dict(step)
    panel = copied.get("agent_panel")
    if isinstance(panel, dict):
        panel_copy = dict(panel)
        name = panel_copy.get("name", "")
        panel_copy.setdefault("work", AGENT_WORK_MAP.get(name, [
            "读取上游Agent输出与工业状态帧",
            "匹配规则库、动作权限矩阵与安全策略",
            "输出审理结论并写入决策Trace",
        ]))
        copied["agent_panel"] = panel_copy
    return copied


DECISION_STEPS: List[Dict] = [
    {
        "focus_node": "state_capture",
        "node_status": {"state_capture": "RUNNING"},
        "agent_panel": {"name": "工业状态帧采集", "status": "RUNNING", "risk": "LOW", "latency": "0ms", "input": "双目相机、AGV视觉、PLC联锁、CRC状态", "rule": "FRAME_CAPTURE_REQUIRED", "evidence": "读取相机帧、点云帧、I/O状态与AGV坐标", "suggestion": "进入算法模型接入阶段", "tool": "CameraBus.read / PLC.read / CRC.check"},
        "log": "工业状态帧采集中：CAMERA_FRAME_1245 / POINT_CLOUD_0891 / PLC_IO_20260509",
    },
    {
        "focus_node": "state_capture",
        "node_status": {"state_capture": "DONE"},
        "snapshot": {"frame": "FRM-20260509-001245", "yolo": "0.98", "depth": "245.21mm", "crc": "PASS", "arm": "READY", "estop": "OFF"},
        "log": "工业状态帧采集完成：状态来源为工业接口自动读取，非人工下拉选择。",
    },
    {
        "focus_node": "context_model",
        "node_status": {"context_model": "RUNNING"},
        "agent_panel": {"name": "任务上下文建模Agent", "status": "RUNNING", "risk": "LOW", "latency": "18ms", "input": "铜箔卷目标、AGV放置点、机械臂状态", "rule": "TASK_CONTEXT_BUILD", "evidence": "目标类型=copper_roll，动作类型=PICK_AND_PLACE", "suggestion": "拆解为识别、定位、规划、联锁、安全、执行约束六路审查", "tool": "ContextBuilder / WorkflowPlanner"},
        "log": "任务上下文建模完成：形成多Agent并行审查任务。",
    },
    {
        "focus_node": "vision_quality",
        "node_status": {"context_model": "DONE", "vision_quality": "RUNNING", "localization_3d": "RUNNING", "placement_plan": "RUNNING", "hardware_interlock": "RUNNING", "safety_strategy": "RUNNING", "execution_constraint": "RUNNING"},
        "agent_panel": {"name": "视觉质量Agent", "status": "RUNNING", "risk": "LOW", "latency": "46ms", "input": "相机帧#1245，图像修复输出，YOLO目标框", "rule": "VISION_CONFIDENCE_GT_0.85", "evidence": "铜箔卷置信度0.98，遮挡率低于阈值", "suggestion": "视觉输入可进入定位与抓取规划", "tool": "YoloCopper.detect / ImageRestore.verify"},
        "log": "六个专家Agent并行启动：视觉、三维定位、放置规划、硬件联锁、安全策略、执行约束。",
    },
    {
        "focus_node": "localization_3d",
        "node_status": {"vision_quality": "PASS", "localization_3d": "RUNNING"},
        "agent_panel": {"name": "三维定位Agent", "status": "RUNNING", "risk": "LOW", "latency": "98ms", "input": "SGBM深度图、点云#0891、目标框ROI", "rule": "DEPTH_RMSE_LT_0.5MM", "evidence": "RMSE=0.21mm，Z轴距离245.21mm", "suggestion": "抓取深度满足轨迹规划输入要求", "tool": "SGBMDepth.estimate / Pose3D.solve"},
        "log": "视觉质量Agent通过；三维定位Agent正在校验深度与位姿。",
    },
    {
        "focus_node": "placement_plan",
        "node_status": {"localization_3d": "PASS", "placement_plan": "RUNNING"},
        "agent_panel": {"name": "放置规划Agent", "status": "RUNNING", "risk": "MEDIUM", "latency": "312ms", "input": "目标位姿、AGV放置坐标、机械臂运动学边界", "rule": "R-PLAN-003 路径可行性规划", "evidence": "生成3条候选路径，最优代价0.32，路径可行率92%", "suggestion": "建议继续使用第3候选路径并限制速度", "tool": "PathPlanner / IK Solver / CollisionCheck"},
        "log": "放置规划Agent聚焦：正在生成第3候选轨迹并校验碰撞。",
    },
    {
        "focus_node": "hardware_interlock",
        "node_status": {"placement_plan": "PASS", "hardware_interlock": "LIMITED"},
        "agent_panel": {"name": "硬件联锁Agent", "status": "LIMITED", "risk": "MEDIUM", "latency": "127ms", "input": "PLC I/O、光栅、安全门、气压、电源状态", "rule": "HARDWARE_INTERLOCK_SAFE_OR_LIMITED", "evidence": "安全门状态存在延时确认，PLC链路在线", "suggestion": "允许降级放行，限制速度至70%", "tool": "PLC.read_coils / Interlock.validate"},
        "log": "硬件联锁Agent返回LIMITED：安全门延时确认，允许降级策略。",
    },
    {
        "focus_node": "execution_constraint",
        "node_status": {"safety_strategy": "PASS", "execution_constraint": "BLOCKED"},
        "agent_panel": {"name": "执行约束Agent", "status": "BLOCKED", "risk": "HIGH", "latency": "64ms", "input": "关节扭矩、末端负载、速度约束、抓取姿态", "rule": "JOINT_TORQUE_MARGIN", "evidence": "J2关节扭矩逼近上限，原速度不可直接放行", "suggestion": "改为LIMITED策略：降速30%，重新生成安全轨迹", "tool": "TorqueCheck / ReachabilityCheck"},
        "log": "执行约束Agent发现高风险约束：J2扭矩接近上限，触发受限执行策略。",
    },
    {
        "focus_node": "fusion_arbitration",
        "node_status": {"fusion_arbitration": "RUNNING"},
        "summary": {"total_agents": 6, "passed": 3, "limited": 1, "blocked": 1, "running": 0, "consensus": "82%", "risk_synthesis": "MEDIUM", "final_action": "LIMITED_PICK_AND_PLACE"},
        "agent_panel": {"name": "融合仲裁 / 最终仲裁Agent", "status": "RUNNING", "risk": "MEDIUM", "latency": "188ms", "input": "六路专家Agent结论", "rule": "WEIGHTED_VOTE_WITH_SAFETY_VETO", "evidence": "3 PASS / 1 LIMITED / 1 BLOCKED / 1 已转限速策略", "suggestion": "以LIMITED策略生成控制任务，禁止原速执行", "tool": "VoteFusion / SafetyVeto / PolicyMatrix"},
        "log": "安全策略仲裁启动：并行Agent结果正在汇聚。",
    },
    {
        "focus_node": "control_task",
        "node_status": {"fusion_arbitration": "PASS", "control_task": "RUNNING"},
        "task": {"task_id": "TASK_20260509_00187", "type": "PICK_AND_PLACE", "arm_id": "ARM_01", "safety_mode": "LIMITED", "speed_scale": 0.7},
        "log": "控制任务生成：PICK_AND_PLACE，安全模式=LIMITED，速度缩放=0.7。",
    },
    {
        "focus_node": "archive",
        "node_status": {"control_task": "PASS", "archive": "RUNNING"},
        "log": "报告归档中：写入证据链、Agent日志、权限矩阵、控制任务摘要。",
    },
    {
        "focus_node": "archive",
        "node_status": {"archive": "PASS"},
        "final": True,
        "summary": {"total_agents": 6, "passed": 4, "limited": 1, "blocked": 1, "running": 0, "consensus": "87%", "risk_synthesis": "MEDIUM", "final_action": "PICK_AND_PLACE_LIMITED"},
        "log": "多Agent智能决策完成：最终动作PICK_AND_PLACE_LIMITED，报告已归档。",
    },
]
