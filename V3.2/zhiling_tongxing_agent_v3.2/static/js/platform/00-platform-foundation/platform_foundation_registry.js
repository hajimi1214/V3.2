const nodeIds = [
  'state_capture','context_model','vision_quality','localization_3d','placement_plan','hardware_interlock','safety_strategy','execution_constraint','fusion_arbitration','control_task','archive'
];

const parallelAgentIds = ['vision_quality','localization_3d','placement_plan','hardware_interlock','safety_strategy','execution_constraint'];

const nodeName = {
  state_capture:'工业状态帧采集',
  context_model:'任务上下文建模Agent',
  vision_quality:'视觉质量Agent',
  localization_3d:'三维定位Agent',
  placement_plan:'放置规划Agent',
  hardware_interlock:'硬件联锁Agent',
  safety_strategy:'安全策略Agent',
  execution_constraint:'执行约束Agent',
  fusion_arbitration:'融合仲裁Agent',
  control_task:'控制任务生成',
  archive:'报告归档'
};

const moduleTitleMap = {
  workbench: '决策工作台总览',
  'tree-panel': '多Agent协同决策树',
  'agent-review': '当前Agent审理台',
  'state-snapshot': '工业状态帧快照',
  'model-output': '算法模型输出概览',
  evidence: '证据链表 / 决策依据',
  matrix: '动作权限矩阵',
  'control-task': '控制任务中心',
  trace: '决策Trace / 运行日志',
  archive: '报告归档摘要',
  alarm: '告警中心',
  config: '系统配置中心',
  'device-config': '系统配置 / 设备参数接入'
};

let source = null;
let running = false;
const $ = (id) => document.getElementById(id);

const DEVICE_STORAGE_KEY = 'zltx_device_config_primary';

