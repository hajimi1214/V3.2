const MANUAL_DEVICE_STORAGE_KEY = 'zltx_device_config_primary';
const MANUAL_FLOW_STORAGE_KEY = 'zltx_agent_workflow_canvas_empty_manual';
const MANUAL_FLOW_MODE_KEY = 'zltx_agent_workflow_mode';
const MANUAL_WORKFLOW_BASE_IDS = ['state_capture','context_model','vision_quality','localization_3d','placement_plan','hardware_interlock','safety_strategy','execution_constraint','fusion_arbitration','control_task','archive'];
let flowCanvasMode = localStorage.getItem(MANUAL_FLOW_MODE_KEY) || 'manual';

function getStoredDevice(){
  try{
    const raw = localStorage.getItem(MANUAL_DEVICE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    console.warn('设备参数读取失败', e);
    return null;
  }
}
function saveStoredDevice(data){
  const payload = {...data, deviceId:'001', connected:true, connectedAt:new Date().toISOString()};
  localStorage.setItem(MANUAL_DEVICE_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}
function clearStoredDevice(){ localStorage.removeItem(MANUAL_DEVICE_STORAGE_KEY); }
function isDeviceConnected(){
  const device = getStoredDevice();
  return Boolean(device && device.connected);
}

function isBaseFlowNode(nodeOrId){
  const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId?.dataset?.node;
  return MANUAL_WORKFLOW_BASE_IDS.includes(id);
}
function visibleFlowNodes(){
  return allFlowNodes().filter(n => !n.classList.contains('workflow-node-hidden'));
}
function setCanvasMode(mode){
  flowCanvasMode = mode === 'auto' ? 'auto' : 'manual';
  localStorage.setItem(MANUAL_FLOW_MODE_KEY, flowCanvasMode);
  document.querySelectorAll('[data-flow-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.flowMode === flowCanvasMode));
  if(flowCanvasMode === 'manual'){
    setCanvasHint('当前为手动添加模式：画布默认空白。添加Agent/仲裁组件后拖动、连线，再执行当前画布。');
  }else{
    setCanvasHint('当前为Agent自动决策模式：点击“一键执行默认配置”后，系统会逐步生成默认多Agent流程。');
  }
}

function hideDefaultNodesForManualCanvas(){
  MANUAL_WORKFLOW_BASE_IDS.forEach(id => {
    const node = getFlowNode(id);
    if(!node) return;
    node.classList.add('workflow-node-hidden');
    node.classList.remove('revealed-node','active','connect-source','status-running','status-pass','status-done','status-limited','status-blocked');
    node.classList.add('status-waiting');
  });
}
function revealDefaultNode(id){
  const node = getFlowNode(id);
  if(!node) return;
  node.classList.remove('workflow-node-hidden','future-node');
  node.classList.add('revealed-node','flow-canvas-node');
  attachNodeEnableToggle(node);
  makeNodeDraggable(node);
}
function setEmptyManualCanvas(removeCustom=true){
  const vp = getFlowViewport();
  if(removeCustom) document.querySelectorAll('#treeViewport .custom-agent').forEach(n => n.remove());
  hideDefaultNodesForManualCanvas();
  flowConnections = [];
  vp?.classList.add('workflow-canvas-empty');
  redrawFlowCanvas();
  $('focusLabel').textContent = '空白画布 / 手动添加Agent';
  setCanvasHint('画布为空：先添加Agent或仲裁组件，再用连线模式定义依赖。默认不会自动显示任何Agent。');
}
function canvasHasVisibleNode(){ return visibleFlowNodes().length > 0; }
function updateEmptyCanvasState(){
  const vp = getFlowViewport();
  if(!vp) return;
  vp.classList.toggle('workflow-canvas-empty', !canvasHasVisibleNode());
}

function buildFlowToolbar(){
  const panel = $('tree-panel');
  const head = panel?.querySelector('.panel-head');
  if(!panel || !head || panel.querySelector('.workflow-canvas-toolbar')) return;
  panel.classList.add('workflow-canvas-mode');
  panel.querySelectorAll('.flow-builder-toolbar').forEach(el => el.remove());
  const toolbar = document.createElement('div');
  toolbar.className = 'workflow-canvas-toolbar';
  toolbar.dataset.noOverlay = 'true';
  const options = Object.entries(ARBITRATION_MODES).map(([key, m]) => `<option value="${key}"${key===getArbitrationMode()?' selected':''}>${m.label}</option>`).join('');
  toolbar.innerHTML = `
    <div class="workflow-mode-group">
      <span class="workflow-mode-label">画布模式</span>
      <button type="button" data-flow-mode="manual" data-flow-action="mode-manual">手动添加Agent</button>
      <button type="button" data-flow-mode="auto" data-flow-action="mode-auto">Agent自动决策</button>
      <span class="workflow-mode-help">默认手动，初始画布为空</span>
    </div>
    <div class="workflow-action-group">
      <button type="button" class="primary" data-flow-action="add-agent">添加Agent/仲裁组件</button>
      <button type="button" data-flow-action="connect-mode">连线模式</button>
      <button type="button" data-flow-action="clear-lines">清空连线</button>
      <button type="button" class="danger" data-flow-action="clear-canvas">清空画布</button>
      <button type="button" data-flow-action="save-flow">保存画布</button>
      <button type="button" class="secondary" data-flow-action="run-current">执行当前画布</button>
      <button type="button" data-flow-action="run-default">一键执行默认配置</button>
      <label class="arbitration-mode-select">仲裁模式 <select id="arbitrationModeSelect" data-no-overlay="true">${options}</select></label>
    </div>`;
  head.insertAdjacentElement('afterend', toolbar);

  const viewport = getFlowViewport();
  if(viewport && !viewport.querySelector('#flowAgentLibrary')){
    const lib = document.createElement('div');
    lib.id = 'flowAgentLibrary';
    lib.className = 'flow-agent-library agent-component-library workflow-agent-library';
    lib.dataset.noOverlay = 'true';
    lib.innerHTML = `<div class="flow-agent-library-head"><b>Agent与仲裁组件库</b><button type="button" data-flow-action="close-agent-library">×</button></div><p>选择后加入空白画布。添加的节点可拖动、连线、停用，也可以删除；默认节点不会出现在手动画布中。</p><div class="agent-lib-section"><h4>专业Agent</h4><div class="agent-lib-list" data-lib="agent"></div></div><div class="agent-lib-section"><h4>仲裁Agent / 仲裁组件</h4><div class="agent-lib-list" data-lib="arbitration"></div></div>`;
    const listAgent = lib.querySelector('[data-lib="agent"]');
    const listArb = lib.querySelector('[data-lib="arbitration"]');
    const seen = new Set();
    AGENT_CATALOG.forEach(agent => {
      if(seen.has(agent.id)) return;
      seen.add(agent.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.addAgentId = agent.id;
      btn.innerHTML = `<span>${agent.icon}</span><b>${agent.name}</b><small>${agent.layer} · ${agent.role}</small>`;
      const isArb = String(agent.layer).includes('仲裁') || String(agent.name).includes('仲裁');
      (isArb ? listArb : listAgent).appendChild(btn);
    });
    viewport.appendChild(lib);
  }
  if(viewport && !viewport.querySelector('#flowCanvasHint')){
    const hint = document.createElement('div');
    hint.id = 'flowCanvasHint';
    hint.className = 'flow-canvas-hint';
    viewport.appendChild(hint);
  }
  applyArbitrationMode();
  setCanvasMode(flowCanvasMode);
}

function enhanceExistingFlowNodes(){
  allFlowNodes().forEach(node => {
    node.classList.add('flow-canvas-node');
    attachNodeEnableToggle(node);
    makeNodeDraggable(node);
    const id = node.dataset.node;
    const meta = getNodeMeta(id);
    if(!node.querySelector('.node-work-summary')){
      const div = document.createElement('div');
      div.className = 'node-work-summary';
      div.textContent = meta.role || '参与多Agent协同决策';
      node.appendChild(div);
    }
    if(isBaseFlowNode(node) && flowCanvasMode === 'manual'){
      node.classList.add('workflow-node-hidden');
      node.classList.remove('revealed-node');
    }
  });
}

function addAgentToCanvas(agentId){
  const viewport = getFlowViewport();
  const data = AGENT_CATALOG.find(a => a.id === agentId);
  if(!viewport || !data) return;
  viewport.classList.remove('workflow-canvas-empty');
  let id = data.id;
  if(getFlowNode(id)){
    customAgentCounter += 1;
    id = `${data.id}_${customAgentCounter}`;
  }
  const isArb = String(data.layer).includes('仲裁') || String(data.name).includes('仲裁');
  const node = document.createElement('article');
  node.id = `node-${id}`;
  node.className = `tree-node ${isArb ? 'fusion' : 'agent'} custom-agent flow-canvas-node status-waiting revealed-node`;
  node.dataset.node = id;
  node.dataset.customType = isArb ? 'arbitration' : 'agent';
  const visibleCount = document.querySelectorAll('#treeViewport .custom-agent').length;
  const col = visibleCount % 4;
  const row = Math.floor(visibleCount / 4);
  node.style.left = `${36 + col * 260}px`;
  node.style.top = `${52 + row * 178}px`;
  node.dataset.positionLocked = 'true';
  node.innerHTML = `<button type="button" class="node-enable-toggle" title="启用 / 停用这个节点" data-no-overlay="true">启用</button><button type="button" class="node-delete-btn" data-flow-action="remove-node" data-node-id="${escapeHtml(id)}" title="删除这个自定义节点" data-no-overlay="true">×</button><em>${data.icon}</em><h3>${escapeHtml(data.name)}</h3><span class="badge">WAITING</span><p>输入摘要：${escapeHtml(data.input)}</p><p>证据：${escapeHtml(data.evidence)}</p><p>输出结论：${escapeHtml(data.output)}</p><strong>风险 ${escapeHtml(data.risk)}</strong><small>${Number(data.latency || 0)}ms</small><div class="node-work-summary">${escapeHtml(data.role)}</div>`;
  viewport.appendChild(node);
  FLOW_NODE_META[id] = {...data, id};
  // 只给新增节点绑定事件，绝不自动连到默认节点。连线由用户决定。
  makeNodeDraggable(node);
  const enable = node.querySelector('.node-enable-toggle');
  enable?.addEventListener('click', (e) => {
    node.classList.toggle('node-disabled');
    enable.textContent = node.classList.contains('node-disabled') ? '停用' : '启用';
    redrawFlowCanvas();
    persistFlowCanvas();
    e.stopPropagation();
  });
  redrawFlowCanvas();
  persistFlowCanvas();
  setCanvasHint(`已添加 ${data.name}。请拖动节点，并使用“连线模式”手动定义它与其他节点的关系。`);
}

function removeCustomAgentFromCanvas(id){
  const node = getFlowNode(id);
  if(!node || !node.classList.contains('custom-agent')){
    showSystemNotice('不能删除默认节点', '只有你手动添加到画布的Agent或仲裁组件可以删除。默认流程节点只会在“Agent自动决策”执行时逐步出现。', '知道了');
    return;
  }
  const name = getNodeMeta(id).name || id;
  node.remove();
  flowConnections = normalizeFlowConnections(flowConnections.filter(([from,to]) => from !== id && to !== id));
  delete FLOW_NODE_META[id];
  redrawFlowCanvas();
  persistFlowCanvas();
  updateEmptyCanvasState();
  setCanvasHint(`已删除自定义节点：${name}`);
}

function persistFlowCanvas(){
  const nodes = visibleFlowNodes().filter(node => node.classList.contains('custom-agent')).map(node => ({
    id: node.dataset.node,
    custom: true,
    customType: node.dataset.customType || '',
    disabled: node.classList.contains('node-disabled'),
    left: node.style.left || '',
    top: node.style.top || '',
    html: node.innerHTML,
    className: node.className
  }));
  const payload = {mode: flowCanvasMode, nodes, connections: flowConnections, arbitrationMode:getArbitrationMode(), savedAt:new Date().toISOString()};
  localStorage.setItem(MANUAL_FLOW_STORAGE_KEY, JSON.stringify(payload));
}

function loadFlowCanvas(){
  try{
    const raw = localStorage.getItem(MANUAL_FLOW_STORAGE_KEY);
    document.querySelectorAll('#treeViewport .custom-agent').forEach(n => n.remove());
    hideDefaultNodesForManualCanvas();
    flowConnections = [];
    if(!raw){
      setEmptyManualCanvas(false);
      return;
    }
    const payload = JSON.parse(raw);
    flowCanvasMode = payload.mode || 'manual';
    if(payload.arbitrationMode) localStorage.setItem(FLOW_ARBITRATION_MODE_KEY, payload.arbitrationMode);
    const viewport = getFlowViewport();
    (payload.nodes || []).forEach(record => {
      if(record.custom && record.id && record.html){
        const node = document.createElement('article');
        node.id = `node-${record.id}`;
        node.dataset.node = record.id;
        node.dataset.customType = record.customType || '';
        node.className = record.className || 'tree-node agent custom-agent flow-canvas-node status-waiting revealed-node';
        node.classList.remove('workflow-node-hidden');
        node.innerHTML = record.html;
        node.style.left = record.left || '60px';
        node.style.top = record.top || '80px';
        node.dataset.positionLocked = 'true';
        viewport?.appendChild(node);
        makeNodeDraggable(node);
      }
    });
    flowConnections = normalizeFlowConnections(payload.connections || []);
    applyArbitrationMode();
    redrawFlowCanvas();
    updateEmptyCanvasState();
  }catch(e){
    console.warn('流程画布加载失败，使用空白手动画布', e);
    setEmptyManualCanvas(true);
  }
}

function redrawFlowCanvas(){
  const viewport = getFlowViewport();
  const svg = ensureFlowCanvasSvg();
  if(!viewport || !svg) return;
  svg.setAttribute('viewBox', `0 0 ${viewport.clientWidth} ${viewport.clientHeight}`);
  Array.from(svg.querySelectorAll('path.flow-canvas-line')).forEach(el => el.remove());
  flowConnections = normalizeFlowConnections(flowConnections).filter(([from,to]) => {
    const a = getFlowNode(from); const b = getFlowNode(to);
    return a && b && !a.classList.contains('workflow-node-hidden') && !b.classList.contains('workflow-node-hidden');
  });
  flowConnections.forEach(([from,to]) => {
    const a = getFlowNode(from); const b = getFlowNode(to);
    if(!a || !b || a.classList.contains('node-disabled') || b.classList.contains('node-disabled')) return;
    const p1 = nodeCenterInViewport(a); const p2 = nodeCenterInViewport(b);
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    const midY = (p1.y + p2.y)/2;
    const d = Math.abs(p1.y-p2.y) < 28 ? `M ${p1.x} ${p1.y} C ${(p1.x+p2.x)/2} ${p1.y}, ${(p1.x+p2.x)/2} ${p2.y}, ${p2.x} ${p2.y}` : `M ${p1.x} ${p1.y} V ${midY} H ${p2.x} V ${p2.y}`;
    path.setAttribute('d', d);
    path.setAttribute('marker-end', 'url(#flowCanvasArrow)');
    path.dataset.from = from; path.dataset.to = to;
    path.classList.add('flow-canvas-line');
    svg.appendChild(path);
  });
  updateEmptyCanvasState();
}

function getEnabledNodeIds(){
  return visibleFlowNodes().filter(n => !n.classList.contains('node-disabled')).map(n => n.dataset.node);
}

function setupDefaultTopologyForRun(){
  document.querySelectorAll('#treeViewport .custom-agent').forEach(n => n.remove());
  MANUAL_WORKFLOW_BASE_IDS.forEach(id => {
    const node = getFlowNode(id);
    if(!node) return;
    node.classList.add('workflow-node-hidden');
    node.classList.remove('revealed-node','node-disabled','active');
    const btn = node.querySelector('.node-enable-toggle');
    if(btn) btn.textContent = '启用';
    node.style.left = '';
    node.style.top = '';
    node.dataset.positionLocked = 'false';
  });
  flowConnections = DEFAULT_FLOW_CONNECTIONS.map(x => [...x]);
  getFlowViewport()?.classList.remove('workflow-canvas-empty');
  applyArbitrationMode();
  redrawFlowCanvas();
}

function computeDefaultLevels(){
  return [
    ['state_capture'],
    ['context_model'],
    ['vision_quality','localization_3d','placement_plan','hardware_interlock','safety_strategy','execution_constraint'],
    ['fusion_arbitration'],
    ['control_task'],
    ['archive']
  ];
}

function computeFlowLevels(){
  const ids = new Set(getEnabledNodeIds());
  const conns = normalizeFlowConnections(flowConnections).filter(([a,b]) => ids.has(a) && ids.has(b));
  const indeg = new Map(Array.from(ids).map(id => [id,0]));
  const out = new Map(Array.from(ids).map(id => [id,[]]));
  conns.forEach(([a,b]) => { indeg.set(b, (indeg.get(b)||0)+1); out.get(a)?.push(b); });
  const levels = [];
  let queue = Array.from(ids).filter(id => (indeg.get(id)||0) === 0);
  const seen = new Set();
  const score = id => {
    const meta = getNodeMeta(id);
    if(String(meta.layer).includes('接入')) return 1;
    if(String(meta.layer).includes('规划')) return 2;
    if(String(meta.layer).includes('仲裁')) return 8;
    if(id === 'control_task') return 9;
    if(id === 'archive') return 10;
    return 5;
  };
  while(queue.length){
    const level = queue.filter(id => !seen.has(id));
    if(!level.length) break;
    levels.push(level.sort((a,b) => score(a)-score(b)));
    const next = [];
    level.forEach(id => {
      seen.add(id);
      (out.get(id) || []).forEach(to => { indeg.set(to, (indeg.get(to)||0)-1); if((indeg.get(to)||0) === 0) next.push(to); });
    });
    queue = next;
  }
  const missed = Array.from(ids).filter(id => !seen.has(id));
  if(missed.length) levels.push(missed.sort((a,b) => score(a)-score(b)));
  return levels;
}

async function startCanvasDecision(useDefault=false){
  if(running) return;
  if(!isDeviceConnected()){
    showSystemNotice('暂无设备连接', '请先进入「系统配置 → 设备参数」，填写设备信息并连接成功后再启动多Agent决策。', '进入系统配置', () => openModuleOverlay('config', '系统配置中心'));
    appendLog('启动被拦截：未接入设备，流程画布只能配置，不能执行决策。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    updateRunGate();
    return;
  }
  let levels;
  if(useDefault){
    setCanvasMode('auto');
    setupDefaultTopologyForRun();
    levels = computeDefaultLevels();
  }else{
    if(!canvasHasVisibleNode()){
      showSystemNotice('空白画布不能执行', '当前处于手动编排模式。请添加Agent/仲裁组件并完成连线，或切换到“Agent自动决策”执行任务工作流。', '知道了');
      setCanvasHint('手动画布为空：请先添加Agent，或者使用一键默认配置。');
      return;
    }
    levels = computeFlowLevels();
    if(!levels.length){
      showSystemNotice('无可执行节点', '当前画布没有启用的Agent节点，请至少启用一个Agent。', '知道了');
      return;
    }
  }
  running = true;
  document.body.classList.add('workflow-template-running');
  $('agentBus').textContent = 'RUNNING';
  const btn = $('startBtn');
  if(btn){ delete btn.dataset.completed; btn.innerHTML = '<span>●</span>流程执行中...'; }
  visibleFlowNodes().forEach(n => { if(!n.classList.contains('node-disabled')) setCanvasNodeStatus(n.dataset.node, 'WAITING'); n.classList.remove('active'); });
  appendLog(`${useDefault ? 'Agent自动决策：默认拓扑逐步生成' : '手动画布执行'}：${levels.flat().length} 个节点，${flowConnections.length} 条依赖连线。`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
  for(const level of levels){
    if(!running) break;
    level.forEach(id => revealDefaultNode(id));
    redrawFlowCanvas();
    await sleep(useDefault ? 520 : 120);
    level.forEach(id => {
      setCanvasNodeStatus(id, 'RUNNING');
      getFlowNode(id)?.classList.add('active');
      updateAgentPanel(buildCanvasAgentPanel(id, 'RUNNING'));
      $('focusLabel').textContent = level.length > 1 ? `并行决策：${level.length}个节点` : getNodeMeta(id).name;
    });
    const names = level.map(id => getNodeMeta(id).name).join('、');
    appendLog(`${level.length > 1 ? '多Agent并行审查' : '节点审查'}：${names} 正在处理。`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    await sleep((useDefault ? 2350 : 2100) + Math.min(level.length, 6) * 260);
    level.forEach(id => {
      const finalStatus = canvasStatusFor(id, false);
      setCanvasNodeStatus(id, finalStatus);
      getFlowNode(id)?.classList.remove('active');
      updateAgentPanel(buildCanvasAgentPanel(id, finalStatus));
      appendLog(`[${getNodeMeta(id).name}] 输出：${getNodeMeta(id).output || finalStatus} / 状态 ${finalStatus}`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    });
    await sleep(480);
  }
  updateTask({task_id:'TASK_FLOW_CANVAS_023', type:'PICK_AND_PLACE', safety_mode:'LIMITED'});
  $('focusLabel').textContent = '流程画布执行完成';
  $('agentBus').textContent = 'DONE';
  if(btn){ btn.dataset.completed = 'true'; btn.innerHTML = '<span>✓</span>决策完成，可重新启动'; }
  running = false;
  document.body.classList.remove('workflow-template-running');
}
function startDecision(){ return flowCanvasMode === 'auto' ? startCanvasDecision(true) : startCanvasDecision(false); }

function initFlowCanvasBuilder(){
  if(flowCanvasInitialized) return;
  flowCanvasInitialized = true;
  const viewport = getFlowViewport();
  if(!viewport) return;
  viewport.classList.add('canvas-builder');
  buildFlowToolbar();
  ensureFlowCanvasSvg();
  enhanceExistingFlowNodes();
  loadFlowCanvas();
  redrawFlowCanvas();
  setCanvasMode(flowCanvasMode);
  window.addEventListener('resize', redrawFlowCanvas);
  document.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-flow-action]');
    if(!actionEl) return;
    const action = actionEl.dataset.flowAction;
    if(action === 'mode-manual') setCanvasMode('manual');
    if(action === 'mode-auto') setCanvasMode('auto');
    if(action === 'run-default') startCanvasDecision(true);
    if(action === 'run-current') startCanvasDecision(false);
    if(action === 'add-agent') $('flowAgentLibrary')?.classList.toggle('open');
    if(action === 'close-agent-library') $('flowAgentLibrary')?.classList.remove('open');
    if(action === 'connect-mode'){
      connectMode = !connectMode;
      connectSource = null;
      document.body.classList.toggle('connect-mode-on', connectMode);
      actionEl.classList.toggle('active', connectMode);
      document.querySelectorAll('.connect-source').forEach(n => n.classList.remove('connect-source'));
      setCanvasHint(connectMode ? '连线模式已开启：先点击源Agent，再点击目标Agent建立依赖。' : '连线模式已关闭。');
    }
    if(action === 'clear-lines'){
      flowConnections = [];
      redrawFlowCanvas();
      persistFlowCanvas();
      setCanvasHint('已清空所有连线。');
    }
    if(action === 'clear-canvas'){
      setEmptyManualCanvas(true);
      setCanvasMode('manual');
      localStorage.removeItem(MANUAL_FLOW_STORAGE_KEY);
    }
    if(action === 'save-flow'){
      persistFlowCanvas();
      showSystemNotice('流程画布已保存', '当前手动添加的Agent、位置、启停状态和连线关系已保存到本地浏览器。', '知道了');
    }
    e.preventDefault(); e.stopPropagation();
  }, true);
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add-agent-id]');
    if(!add) return;
    addAgentToCanvas(add.dataset.addAgentId);
    e.preventDefault(); e.stopPropagation();
  }, true);
}

function refreshWorkflowLabels(){
  document.querySelectorAll('.brand-ver').forEach(el => el.textContent = 'V3.2');
  const version = document.querySelector('.platform-card .pc-row:last-child strong');
  if(version) version.textContent = 'V3.2';
  const mapBtn = document.querySelector('.agent-map-trigger');
  if(mapBtn) mapBtn.innerHTML = '参与Agent：<b>可自定义</b> · 查看作用';
  const controlNode = getFlowNode('control_task');
  controlNode?.classList.add('module-node');
  const archiveNode = getFlowNode('archive');
  archiveNode?.classList.add('module-node');
  const controlH = controlNode?.querySelector('h3'); if(controlH) controlH.textContent = '控制任务生成模块';
  const archiveH = archiveNode?.querySelector('h3'); if(archiveH) archiveH.textContent = '报告归档模块';
  applyArbitrationMode();
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    refreshWorkflowLabels();
    updateRunGate();
    const select = $('arbitrationModeSelect');
    if(select) select.value = getArbitrationMode();
    if(!localStorage.getItem(MANUAL_FLOW_STORAGE_KEY)) setEmptyManualCanvas(true);
    setCanvasMode(flowCanvasMode);
    redrawFlowCanvas();
  }, 240);
});


