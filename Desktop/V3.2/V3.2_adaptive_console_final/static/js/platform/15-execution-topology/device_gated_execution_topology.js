const EXECUTION_TOPOLOGY_VERSION = 'V3.2';
const EXECUTION_TOPOLOGY_BUILD = 'V3.2';

function zltxHasStoredDecisionTreeForTopology(){
  try{
    const session = JSON.parse(localStorage.getItem('zltx_decision_session_v33') || 'null');
    if(!session || typeof session !== 'object') return false;
    const revealed = Array.isArray(session.revealed_nodes) ? session.revealed_nodes.length : 0;
    const statusCount = session.node_status && typeof session.node_status === 'object' ? Object.keys(session.node_status).length : 0;
    const bus = String(session.bus_state || '').trim();
    const task = String(session.task_json || '').trim();
    return Boolean(session.decision_started)
      || Boolean(session.start_completed)
      || revealed > 1
      || statusCount > 1
      || /DONE|RUNNING|完成|运行中/u.test(bus)
      || (task && !/WAITING_FOR_DECISION|WAIT_DEVICE_OR_REVIEW|"status"\s*:\s*"EMPTY"/u.test(task));
  }catch(err){
    return false;
  }
}

function executionTopologyBaseFlowIds(){
  if(typeof ROUTE_BASE_FLOW_IDS !== 'undefined' && Array.isArray(ROUTE_BASE_FLOW_IDS)) return ROUTE_BASE_FLOW_IDS;
  if(typeof MANUAL_WORKFLOW_BASE_IDS !== 'undefined' && Array.isArray(MANUAL_WORKFLOW_BASE_IDS)) return MANUAL_WORKFLOW_BASE_IDS;
  return ['state_capture','context_model','vision_quality','localization_3d','placement_plan','hardware_interlock','safety_strategy','execution_constraint','fusion_arbitration','control_task','archive'];
}

function setExecutionFlowModeIndicator(mode='manual'){
  flowCanvasMode = mode === 'auto' ? 'auto' : 'manual';
  try{
    if(typeof MANUAL_FLOW_MODE_KEY !== 'undefined') localStorage.setItem(MANUAL_FLOW_MODE_KEY, flowCanvasMode);
    if(typeof NAV_FLOW_MODE_KEY !== 'undefined') localStorage.setItem(NAV_FLOW_MODE_KEY, flowCanvasMode);
  }catch(e){}
  document.querySelectorAll('[data-flow-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.flowMode === flowCanvasMode));
}

function resetExecutionNodeToHidden(id){
  const node = getFlowNode?.(id);
  if(!node) return;
  node.classList.add('workflow-node-hidden','future-node','status-waiting');
  node.classList.remove('revealed-node','active','node-disabled','status-running','status-pass','status-done','status-limited','status-blocked');
  node.style.visibility = '';
  node.style.opacity = '';
  const btn = node.querySelector('.node-enable-toggle');
  if(btn) btn.textContent = '启用';
}

function clearDecisionTreeForNoDevice(){
  if(zltxHasStoredDecisionTreeForTopology()){
    return false;
  }
  running = false;
  document.body.classList.add('no-device-execution-flow');
  document.body.classList.remove('connected-auto-flow-expanded','execution-step-flow','workflow-template-running','compact-workflow-flow');
  document.querySelectorAll('#treeViewport .custom-agent').forEach(n => n.remove());
  executionTopologyBaseFlowIds().forEach(resetExecutionNodeToHidden);
  flowConnections = [];
  setExecutionFlowModeIndicator('manual');
  const vp = getFlowViewport?.();
  if(vp){
    vp.classList.add('workflow-canvas-empty','device-gated-empty');
    try{ vp.scrollTo({left:0, top:0, behavior:'auto'}); }catch(e){ vp.scrollLeft = 0; vp.scrollTop = 0; }
  }
  const svg = ensureFlowCanvasSvg?.();
  if(svg){
    Array.from(svg.querySelectorAll('path.flow-canvas-line')).forEach(el => el.remove());
    const w = Math.max(980, vp?.clientWidth || 980);
    const h = Math.max(420, vp?.clientHeight || 420);
    svg.style.width = `${w}px`;
    svg.style.height = `${h}px`;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  const focus = $('focusLabel');
  if(focus) focus.textContent = '暂无设备连接';
  setCanvasHint?.('暂无设备连接：决策树不会加载。请先进入系统配置完成设备接入，再启动Agent自动决策。');
  const btn = $('startBtn');
  if(btn && !isDeviceConnected?.()) btn.innerHTML = '<span>⚠</span>暂无设备连接';
  localizeVisibleStatuses?.();
}

function applyExecutionStepFlowLayout(){
  const vp = getFlowViewport?.();
  if(!vp) return {width:1280, height:620};
  // 文本优先的工业展示布局：为较大的中文字号预留充足纵向间距，
  // 避免 Agent 卡片内容压到下一排节点。
  const width = Math.max(1260, vp.clientWidth - 16);
  const height = Math.max(860, Math.min(980, Math.max(vp.clientHeight + 360, 860)));
  vp.style.setProperty('--workflow-canvas-w', `${width}px`);
  vp.style.setProperty('--workflow-canvas-h', `${height}px`);
  const positions = {
    state_capture: {left: Math.round(width * .07), top: 48, width: 330},
    context_model: {left: Math.round(width * .56), top: 48, width: 410},
    vision_quality: {left: Math.round(width * .07), top: 214, width: 285},
    localization_3d: {left: Math.round(width * .37), top: 214, width: 285},
    placement_plan: {left: Math.round(width * .67), top: 214, width: 285},
    hardware_interlock: {left: Math.round(width * .07), top: 432, width: 285},
    safety_strategy: {left: Math.round(width * .37), top: 432, width: 285},
    execution_constraint: {left: Math.round(width * .67), top: 432, width: 285},
    fusion_arbitration: {left: Math.round(width * .18), top: 692, width: 390},
    control_task: {left: Math.round(width * .53), top: 692, width: 330},
    archive: {left: Math.round(width * .78), top: 692, width: 285}
  };
  Object.entries(positions).forEach(([id, pos]) => {
    const node = getFlowNode?.(id);
    if(!node) return;
    node.classList.add('flow-canvas-node');
    node.style.left = `${pos.left}px`;
    node.style.top = `${pos.top}px`;
    node.style.width = `${pos.width}px`;
    node.style.height = 'auto';
    node.style.maxHeight = 'none';
    node.dataset.positionLocked = 'true';
  });
  const svg = ensureFlowCanvasSvg?.();
  if(svg){
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  return {width, height};
}

function isExecutionNodeVisible(id){
  const node = getFlowNode?.(id);
  return Boolean(node && !node.classList.contains('workflow-node-hidden'));
}

function drawVisibleExecutionFlowLines(){
  const vp = getFlowViewport?.();
  const svg = ensureFlowCanvasSvg?.();
  if(!vp || !svg) return;
  const size = applyExecutionStepFlowLayout();
  svg.style.width = `${size.width}px`;
  svg.style.height = `${size.height}px`;
  svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
  Array.from(svg.querySelectorAll('path.flow-canvas-line')).forEach(el => el.remove());
  const conns = normalizeFlowConnections?.(flowConnections || []) || [];
  conns.forEach(([from,to]) => {
    const a = getFlowNode?.(from);
    const b = getFlowNode?.(to);
    if(!a || !b) return;
    if(a.classList.contains('workflow-node-hidden') || b.classList.contains('workflow-node-hidden')) return;
    if(a.classList.contains('node-disabled') || b.classList.contains('node-disabled')) return;
    const p1 = nodeCenterInViewport(a);
    const p2 = nodeCenterInViewport(b);
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    const midY = Math.round((p1.y + p2.y) / 2);
    const d = Math.abs(p1.y - p2.y) < 35
      ? `M ${p1.x} ${p1.y} C ${(p1.x+p2.x)/2} ${p1.y}, ${(p1.x+p2.x)/2} ${p2.y}, ${p2.x} ${p2.y}`
      : `M ${p1.x} ${p1.y} V ${midY} H ${p2.x} V ${p2.y}`;
    path.setAttribute('d', d);
    path.setAttribute('marker-end', 'url(#flowCanvasArrow)');
    path.dataset.from = from;
    path.dataset.to = to;
    path.classList.add('flow-canvas-line','execution-step-line');
    if(a.classList.contains('active') || b.classList.contains('active')) path.classList.add('active-line');
    svg.appendChild(path);
  });
  updateEmptyCanvasState?.();
}

function prepareDeviceGatedStepTopology(){
  if(!isDeviceConnected?.()){
    clearDecisionTreeForNoDevice();
    return false;
  }
  document.body.classList.remove('no-device-execution-flow','connected-auto-flow-expanded','empty-workflow-flow');
  document.body.classList.add('execution-step-flow','compact-workflow-flow');
  document.querySelectorAll('#treeViewport .custom-agent').forEach(n => n.remove());
  executionTopologyBaseFlowIds().forEach(resetExecutionNodeToHidden);
  flowConnections = DEFAULT_FLOW_CONNECTIONS.map(x => [...x]);
  const vp = getFlowViewport?.();
  if(vp){
    vp.classList.remove('workflow-canvas-empty','device-gated-empty');
    try{ vp.scrollTo({left:0, top:0, behavior:'auto'}); }catch(e){ vp.scrollLeft = 0; vp.scrollTop = 0; }
  }
  applyExecutionStepFlowLayout();
  drawVisibleExecutionFlowLines();
  setCanvasHint?.('Agent自动决策已准备：节点将按“状态采集 → 任务建模 → 多Agent并行审查 → 融合仲裁 → 控制生成 → 归档”逐步出现。');
  setExecutionFlowModeIndicator('auto');
  return true;
}

function revealExecutionFlowNode(id){
  const node = getFlowNode?.(id);
  if(!node) return null;
  node.classList.remove('workflow-node-hidden','future-node','node-disabled');
  node.classList.add('revealed-node','flow-canvas-node','status-waiting');
  node.style.visibility = 'visible';
  node.style.opacity = '1';
  attachNodeEnableToggle?.(node);
  makeNodeDraggable?.(node);
  const btn = node.querySelector('.node-enable-toggle');
  if(btn) btn.textContent = '启用';
  return node;
}

const redrawFlowCanvasBeforeExecutionTopology = typeof redrawFlowCanvas === 'function' ? redrawFlowCanvas : null;
redrawFlowCanvas = function(){
  if(!isDeviceConnected?.() && !zltxHasStoredDecisionTreeForTopology()){
    const svg = ensureFlowCanvasSvg?.();
    if(svg) Array.from(svg.querySelectorAll('path.flow-canvas-line')).forEach(el => el.remove());
    updateEmptyCanvasState?.();
    return;
  }
  if(document.body.classList.contains('execution-step-flow')){
    drawVisibleExecutionFlowLines();
    return;
  }
  return redrawFlowCanvasBeforeExecutionTopology?.();
};

setupDefaultTopologyForRun = function(){
  prepareDeviceGatedStepTopology();
};

const startCanvasDecisionBeforeExecutionTopology = typeof startCanvasDecision === 'function' ? startCanvasDecision : null;
startCanvasDecision = async function(useDefault=false){
  if(!useDefault) return startCanvasDecisionBeforeExecutionTopology?.apply(this, arguments);
  if(running) return;
  if(!isDeviceConnected?.()){
    clearDecisionTreeForNoDevice();
    showSystemNotice?.('暂无设备连接', '未连接设备时，决策树保持空白，不能加载默认流程。请先进入「系统配置」完成设备接入。', '进入系统配置', () => routeToModule?.('config', '系统配置'));
    appendLog?.('启动被拦截：暂无设备连接，决策树保持空白。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    updateRunGate?.();
    return;
  }
  const ok = prepareDeviceGatedStepTopology();
  if(!ok) return;
  const levels = typeof computeDefaultLevels === 'function' ? computeDefaultLevels() : [executionTopologyBaseFlowIds()];
  running = true;
  document.body.classList.add('workflow-template-running','execution-step-flow');
  const bus = $('agentBus');
  if(bus){ bus.dataset.state = 'RUNNING'; bus.textContent = typeof localizedStatusText === 'function' ? localizedStatusText('RUNNING') : '运行中'; }
  const btn = $('startBtn');
  if(btn){ delete btn.dataset.completed; btn.innerHTML = '<span>●</span>流程执行中...'; }
  const focus = $('focusLabel');
  appendLog?.(`Agent自动决策启动：将按 ${levels.length} 个阶段逐步生成决策树，而不是一次性显示全部节点。`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
  for(const level of levels){
    if(!running) break;
    const names = level.map(id => getNodeMeta?.(id)?.name || id).join('、');
    level.forEach(id => {
      const node = revealExecutionFlowNode(id);
      if(!node) return;
      setCanvasNodeStatus?.(id, 'RUNNING');
      node.classList.add('active');
      updateAgentPanel?.(buildCanvasAgentPanel?.(id, 'RUNNING'));
    });
    if(focus) focus.textContent = level.length > 1 ? `多Agent并行审查：${level.length}个Agent` : (getNodeMeta?.(level[0])?.name || 'Agent审理中');
    drawVisibleExecutionFlowLines();
    localizeVisibleStatuses?.();
    appendLog?.(`${level.length > 1 ? '并行阶段出现' : '流程节点出现'}：${names} 正在审查。`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    await sleep?.(level.length > 1 ? 2300 : 1650);
    level.forEach(id => {
      const node = getFlowNode?.(id);
      if(!node) return;
      const finalStatus = canvasStatusFor?.(id, false) || 'PASS';
      setCanvasNodeStatus?.(id, finalStatus);
      node.classList.remove('active');
      updateAgentPanel?.(buildCanvasAgentPanel?.(id, finalStatus));
      appendLog?.(`[${getNodeMeta?.(id)?.name || id}] 输出：${getNodeMeta?.(id)?.output || finalStatus} / 状态 ${finalStatus}`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    });
    drawVisibleExecutionFlowLines();
    localizeVisibleStatuses?.();
    await sleep?.(420);
  }
  updateTask?.({task_id:'TASK_FLOW_CANVAS_034', type:'PICK_AND_PLACE', safety_mode:'LIMITED'});
  if(focus) focus.textContent = '流程画布执行完成';
  const busDone = $('agentBus');
  if(busDone){ busDone.dataset.state = 'DONE'; busDone.textContent = typeof localizedStatusText === 'function' ? localizedStatusText('DONE') : '完成'; }
  if(btn){ btn.dataset.completed = 'true'; btn.innerHTML = '<span>✓</span>决策完成，可重新启动'; }
  running = false;
  document.body.classList.remove('workflow-template-running');
  drawVisibleExecutionFlowLines();
  localizeVisibleStatuses?.();
};

startDecision = function(){
  return flowCanvasMode === 'auto' ? startCanvasDecision(true) : startCanvasDecision(false);
};

window.addEventListener('click', (e) => {
  const action = e.target.closest('[data-flow-action]')?.dataset.flowAction;
  if(!action) return;
  if(['mode-auto','run-default','mode-manual','clear-canvas'].includes(action)){
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  if(action === 'mode-auto'){
    if(!isDeviceConnected?.()){
      clearDecisionTreeForNoDevice();
      showSystemNotice?.('暂无设备连接', '未连接设备时不会显示默认决策树。请先完成设备接入。', '进入系统配置', () => routeToModule?.('config', '系统配置'));
      return;
    }
    setExecutionFlowModeIndicator('auto');
    document.body.classList.remove('no-device-execution-flow','connected-auto-flow-expanded');
    document.body.classList.add('execution-step-flow');
    setCanvasHint?.('Agent自动决策模式已选择：点击“一键执行默认配置”后，决策树将按阶段逐步出现。');
    return;
  }
  if(action === 'run-default'){
    startCanvasDecision(true);
    return;
  }
  if(action === 'mode-manual' || action === 'clear-canvas'){
    running = false;
    document.body.classList.remove('connected-auto-flow-expanded','execution-step-flow');
    setExecutionFlowModeIndicator('manual');
    if(!isDeviceConnected?.() && !zltxHasStoredDecisionTreeForTopology()) clearDecisionTreeForNoDevice();
    else emptyDecisionCanvas?.();
  }
}, true);

const updateRunGateBeforeExecutionTopology = typeof updateRunGate === 'function' ? updateRunGate : null;
if(updateRunGateBeforeExecutionTopology){
  updateRunGate = function(){
    const ret = updateRunGateBeforeExecutionTopology.apply(this, arguments);
    if(!isDeviceConnected?.() && !zltxHasStoredDecisionTreeForTopology()) clearDecisionTreeForNoDevice();
    setIndustrialStateFrameMedia?.(isDeviceConnected?.());
    return ret;
  };
}

const routeToModuleBeforeExecutionTopology = typeof routeToModule === 'function' ? routeToModule : null;
if(routeToModuleBeforeExecutionTopology){
  routeToModule = function(targetId='workbench', title){
    const ret = routeToModuleBeforeExecutionTopology.apply(this, arguments);
    requestAnimationFrame(() => {
      if(!isDeviceConnected?.() && !zltxHasStoredDecisionTreeForTopology()) clearDecisionTreeForNoDevice();
      else if(targetId === 'tree-panel' || targetId === 'workbench') applyExecutionStepFlowLayout();
      setIndustrialStateFrameMedia?.(isDeviceConnected?.());
    });
    return ret;
  };
}

function applyPlatformVersionLabelsFromExecutionTopology(){
  document.title = '智领铜行--人工智能机械臂多Agent智能决策平台 V3.2';
  document.querySelectorAll('.brand-ver').forEach(el => el.textContent = PLATFORM_VERSION);
  const version = document.querySelector('.platform-card .pc-row:last-child strong');
  if(version) version.textContent = EXECUTION_TOPOLOGY_BUILD;
  setStatusBusLabels?.();
  localizeVisibleStatuses?.();
  setIndustrialStateFrameMedia?.(isDeviceConnected?.());
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    applyPlatformVersionLabelsFromExecutionTopology();
    if(!isDeviceConnected?.() && !zltxHasStoredDecisionTreeForTopology()) clearDecisionTreeForNoDevice();
    updateRunGate?.();
  }, 2350);
});

setTimeout(() => {
  applyPlatformVersionLabelsFromExecutionTopology?.();
  if(!isDeviceConnected?.() && !zltxHasStoredDecisionTreeForTopology()) clearDecisionTreeForNoDevice();
}, 2800);



