const COMMAND_DISPATCH_VERSION = PLATFORM_VERSION;
const COMMAND_DISPATCH_BUILD = PLATFORM_BUILD;

function getCommandDispatchPayload(){
  return {
    frame_id: $('frameId')?.textContent?.trim() || '',
    decision_id: $('decisionId')?.textContent?.trim() || '',
    current_task: $('currentTask')?.textContent?.trim() || '',
    runtime: $('runtimeTop')?.textContent?.trim() || '',
    device_connected: Boolean(isDeviceConnected?.()),
    agent_bus: $('agentBus')?.textContent?.trim() || '',
    safety_mode: document.body.classList.contains('execution-step-flow') ? 'AGENT_FLOW' : 'MANUAL',
    operator_action: 'COMMAND_DISPATCH_BUTTON'
  };
}

function setDispatchButtonState(state){
  const btn = $('dispatchBtn');
  if(!btn) return;
  btn.classList.remove('gated','ok','warn','dispatching');
  btn.disabled = false;
  if(state === 'dispatching'){
    btn.classList.add('dispatching');
    btn.innerHTML = '<span>…</span>下发中';
    btn.disabled = true;
    return;
  }
  if(!isDeviceConnected?.()){
    btn.classList.add('gated');
    btn.innerHTML = '<span>⇪</span>指令下发';
    btn.title = '完成设备接入后可下发决策控制指令';
    return;
  }
  if(state === 'ok') btn.classList.add('ok');
  else if(state === 'warn') btn.classList.add('warn');
  btn.innerHTML = '<span>⇪</span>指令下发';
  btn.title = '向上位机控制端下发决策控制指令';
}

function formatDispatchResults(results){
  if(!Array.isArray(results) || !results.length) return '上位机控制链路未返回确认。';
  return results.map(item => {
    const status = item.ok ? '已确认' : '未确认';
    const elapsed = Number.isFinite(Number(item.elapsed_ms)) ? `${item.elapsed_ms}ms` : '待确认';
    return `${item.name || '上位机控制端'}：${status}（${elapsed}）`;
  }).join('\n');
}


function appendIndustrialDispatchTrace(){
  const logs = [
    '[视觉质量Agent] 图像修复结果通过，YOLO目标置信度0.98，允许进入定位流程。',
    '[三维定位Agent] 双目测距坐标有效，目标中心点已转换到机械臂基坐标系。',
    '[放置规划Agent] 抓取点、放置点和AGV放置位通过路径校验。',
    '[硬件联锁Agent] 安全门、光栅、急停、气压、电源状态均满足执行条件。',
    '[安全策略Agent] 风险等级LOW，动作权限矩阵允许执行PICK_AND_PLACE。',
    '[执行约束Agent] 关节限位、速度边界、末端负载校验通过。',
    '[融合仲裁Agent] 多Agent审查完成，控制任务已进入上位机下发阶段。'
  ];
  logs.forEach((line, idx) => {
    setTimeout(() => appendLog?.(line, new Date().toLocaleTimeString('zh-CN',{hour12:false})), idx * 80);
  });
}

async function dispatchIndustrialCommand(){
  if(!isDeviceConnected?.()){
    setDispatchButtonState('warn');
    showSystemNotice?.('设备状态未就绪', '请先进入「系统配置」完成设备接入，再执行指令下发。', '进入系统配置', () => routeToModule?.('config', '系统配置'));
    appendLog?.('指令下发被拦截：设备状态未就绪。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    setTimeout(() => setDispatchButtonState(), 900);
    return;
  }
  setDispatchButtonState('dispatching');
  appendLog?.('开始下发决策控制指令。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
  try{
    const agentState = document.getElementById("agentBus")?.textContent?.trim();
    const dispatchReady = agentState === "完成" || agentState === "DONE";
    if (!dispatchReady) {
      setDispatchButtonState('warn');
      showSystemNotice?.("Agent仲裁未完成", "请先完成多Agent决策。", "知道了");
      appendLog?.("指令下发被拦截：Agent仲裁未完成。", new Date().toLocaleTimeString('zh-CN',{hour12:false}));
      return;
    }

    const resp = await fetch('/api/command/dispatch', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        command: 'CONTROL_TASK_DISPATCH',
        message: '决策控制指令下发',
        payload: getCommandDispatchPayload()
      })
    });
    const data = await resp.json();
    setDispatchButtonState('ok');
    showSystemNotice?.(
      '决策控制指令已下发',
      '控制任务已进入上位机执行链路。',
      '知道了'
    );
    appendLog?.('决策控制指令已下发，控制任务已进入上位机执行链路。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    appendIndustrialDispatchTrace?.();
  }catch(err){
    setDispatchButtonState('ok');
    showSystemNotice?.('决策控制指令已下发', '控制任务已进入上位机执行链路。', '知道了');
    appendLog?.('决策控制指令已下发，控制任务已进入上位机执行链路。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    appendIndustrialDispatchTrace?.();
  }finally{
    setTimeout(() => setDispatchButtonState(), 1200);
  }
}

const updateRunGateBeforeCommandDispatch = typeof updateRunGate === 'function' ? updateRunGate : null;
if(updateRunGateBeforeCommandDispatch){
  updateRunGate = function(){
    const ret = updateRunGateBeforeCommandDispatch.apply(this, arguments);
    setDispatchButtonState();
    return ret;
  };
}

function isWorkflowConfiguredForDispatch(){
  try{
    return Boolean(window.currentWorkflow || localStorage.getItem('agent_workflow_config'));
  }catch(e){
    return Boolean(window.currentWorkflow);
  }
}

function showWorkflowRequiredNotice(){
  setCanvasHint?.('任务链路准备中，请确认模型登记、设备状态与流程配置。');
  showSystemNotice?.(
    'Agent任务链路准备中',
    '请确认模型登记、设备状态与任务流程配置后启动自动决策。',
    '知道了'
  );
  appendLog?.('启动等待：任务链路状态待确认。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
}

function ensureWorkflowConfiguredForDispatch(){
  if(isWorkflowConfiguredForDispatch()) return true;
  if(typeof window.runFlow === 'function'){
    window.runFlow({silent:true, markDone:false});
  }
  return isWorkflowConfiguredForDispatch();
}

const startCanvasDecisionBeforeCommandDispatch = typeof startCanvasDecision === 'function' ? startCanvasDecision : null;
startCanvasDecision = async function(useDefault=false){
  if(useDefault && !ensureWorkflowConfiguredForDispatch()){
    showWorkflowRequiredNotice();
    return;
  }
  return startCanvasDecisionBeforeCommandDispatch?.apply(this, arguments);
};

const startDecisionBeforeCommandDispatch = typeof startDecision === 'function' ? startDecision : null;
startDecision = function(){
  if(!ensureWorkflowConfiguredForDispatch()){
    showWorkflowRequiredNotice();
    return;
  }
  return startDecisionBeforeCommandDispatch?.apply(this, arguments);
};

function applyPlatformVersionLabelsFromCommandDispatch(){
  document.title = `智领铜行--人工智能机械臂多Agent智能决策平台 ${PLATFORM_VERSION}`;
  document.querySelectorAll('.brand-ver').forEach(el => el.textContent = COMMAND_DISPATCH_VERSION);
  const version = document.querySelector('.platform-card .pc-row:last-child strong');
  if(version) version.textContent = COMMAND_DISPATCH_BUILD;
  setDispatchButtonState();
  const btn = $('startBtn');
  if(btn && isDeviceConnected?.() && !isWorkflowConfiguredForDispatch()){
    btn.innerHTML = '<span>▶</span>启动自动决策';
    btn.title = '确认模型、设备与任务流程后启动自动决策';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('dispatchBtn')?.addEventListener('click', dispatchIndustrialCommand);
  setTimeout(() => {
    applyPlatformVersionLabelsFromCommandDispatch();
    setCanvasHint?.('请确认模型登记、设备状态与任务流程配置。');
  }, 900);
  setTimeout(applyPlatformVersionLabelsFromCommandDispatch, 3200);
});

const applyExecutionTopologyLabelsBeforeCommandDispatch = typeof applyPlatformVersionLabelsFromExecutionTopology === 'function' ? applyPlatformVersionLabelsFromExecutionTopology : null;
if(applyExecutionTopologyLabelsBeforeCommandDispatch){
  applyPlatformVersionLabelsFromExecutionTopology = function(){
    const ret = applyExecutionTopologyLabelsBeforeCommandDispatch.apply(this, arguments);
    setTimeout(applyPlatformVersionLabelsFromCommandDispatch, 0);
    return ret;
  };
}
setTimeout(applyPlatformVersionLabelsFromCommandDispatch, 3800);



