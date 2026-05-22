const LAYOUT_DEVICE_STORAGE_KEY = 'zltx_device_config_primary';
const LAYOUT_FLOW_STORAGE_KEY = 'zltx_agent_workflow_canvas_layout';
const LAYOUT_FLOW_MODE_KEY = 'zltx_agent_workflow_mode';

function getStoredDevice(){
  try{
    const raw = localStorage.getItem(LAYOUT_DEVICE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    console.warn('设备参数读取失败', e);
    return null;
  }
}
function saveStoredDevice(data){
  const payload = {...data, deviceId:'001', connected:true, connectedAt:new Date().toISOString()};
  localStorage.setItem(LAYOUT_DEVICE_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}
function clearStoredDevice(){ localStorage.removeItem(LAYOUT_DEVICE_STORAGE_KEY); }
function isDeviceConnected(){
  const device = getStoredDevice();
  return Boolean(device && device.connected);
}

function buildFlowToolbar(){
  const panel = $('tree-panel');
  const head = panel?.querySelector('.panel-head');
  if(!panel || !head || panel.querySelector('.workflow-canvas-toolbar')) return;
  panel.classList.add('workflow-canvas-mode','workflow-canvas-mode');
  panel.querySelectorAll('.flow-builder-toolbar').forEach(el => el.remove());
  const toolbar = document.createElement('div');
  toolbar.className = 'workflow-canvas-toolbar workflow-canvas-toolbar';
  toolbar.dataset.noOverlay = 'true';
  const options = Object.entries(ARBITRATION_MODES).map(([key, m]) => `<option value="${key}"${key===getArbitrationMode()?' selected':''}>${m.label}</option>`).join('');
  toolbar.innerHTML = `
    <div class="workflow-mode-group">
      <span class="workflow-mode-label">画布模式</span>
      <button type="button" data-flow-mode="manual" data-flow-action="mode-manual">手动添加Agent</button>
      <button type="button" data-flow-mode="auto" data-flow-action="mode-auto">Agent自动决策</button>
      <span class="workflow-mode-help">默认空白画布，可拖拽组件库</span>
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
    lib.className = 'flow-agent-library agent-component-library workflow-agent-library workflow-agent-library';
    lib.dataset.noOverlay = 'true';
    lib.innerHTML = `<div class="flow-agent-library-head" data-drag-handle="true"><b>Agent与仲裁组件库</b><div class="library-head-actions"><button type="button" title="折叠/展开" data-flow-action="toggle-library-size">—</button><button type="button" data-flow-action="close-agent-library">×</button></div></div><p>该面板可拖动，也可右下角拉伸。选择后加入空白画布，节点可拖动、连线、停用和删除。</p><div class="agent-lib-section"><h4>专业Agent</h4><div class="agent-lib-list" data-lib="agent"></div></div><div class="agent-lib-section"><h4>仲裁Agent / 仲裁组件</h4><div class="agent-lib-list" data-lib="arbitration"></div></div>`;
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
    initAgentLibraryDrag(lib);
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

function initAgentLibraryDrag(lib){
  if(!lib || lib.dataset.workflowDragReady === 'true') return;
  lib.dataset.workflowDragReady = 'true';
  const head = lib.querySelector('.flow-agent-library-head');
  if(!head) return;
  head.addEventListener('pointerdown', (e) => {
    if(e.button !== 0) return;
    if(e.target.closest('button,select,input')) return;
    const rect = lib.getBoundingClientRect();
    lib.style.position = 'fixed';
    lib.style.left = `${rect.left}px`;
    lib.style.top = `${rect.top}px`;
    lib.style.right = 'auto';
    lib.classList.add('dragging-library');
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = rect.left;
    const startTop = rect.top;
    const onMove = (ev) => {
      const nextLeft = Math.max(8, Math.min(window.innerWidth - lib.offsetWidth - 8, startLeft + ev.clientX - startX));
      const nextTop = Math.max(8, Math.min(window.innerHeight - 56, startTop + ev.clientY - startY));
      lib.style.left = `${nextLeft}px`;
      lib.style.top = `${nextTop}px`;
    };
    const onUp = () => {
      lib.classList.remove('dragging-library');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      try{
        localStorage.setItem('zltx_agent_library_position', JSON.stringify({left:lib.style.left, top:lib.style.top, width:lib.style.width || '', height:lib.style.height || ''}));
      }catch(err){}
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    e.preventDefault();
  });
  try{
    const saved = JSON.parse(localStorage.getItem('zltx_agent_library_position') || 'null');
    if(saved?.left && saved?.top){
      lib.style.position = 'fixed';
      lib.style.left = saved.left;
      lib.style.top = saved.top;
      lib.style.right = 'auto';
      if(saved.width) lib.style.width = saved.width;
      if(saved.height) lib.style.height = saved.height;
    }
  }catch(e){}
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
  localStorage.setItem(LAYOUT_FLOW_STORAGE_KEY, JSON.stringify(payload));
}

function loadFlowCanvas(){
  try{
    const raw = localStorage.getItem(LAYOUT_FLOW_STORAGE_KEY);
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

document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-flow-action]');
  if(!actionEl) return;
  if(actionEl.dataset.flowAction === 'toggle-library-size'){
    const lib = $('flowAgentLibrary');
    if(lib){ lib.classList.toggle('library-minimized'); }
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const lib = $('flowAgentLibrary');
    if(lib) initAgentLibraryDrag(lib);
    refreshWorkflowLabels();
    updateRunGate();
  }, 420);
});

// V3.2 mode storage isolation: do not inherit V3.2 auto/manual state.
try { flowCanvasMode = localStorage.getItem(LAYOUT_FLOW_MODE_KEY) || 'manual'; } catch(e) { flowCanvasMode = 'manual'; }
function setCanvasMode(mode){
  flowCanvasMode = mode === 'auto' ? 'auto' : 'manual';
  localStorage.setItem(LAYOUT_FLOW_MODE_KEY, flowCanvasMode);
  document.querySelectorAll('[data-flow-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.flowMode === flowCanvasMode));
  if(flowCanvasMode === 'manual'){
    setCanvasHint('当前为手动添加模式：画布默认空白。可打开右侧可拖动组件库，添加Agent后拖动、连线并执行。');
  }else{
    setCanvasHint('当前为Agent自动决策模式：点击“一键执行默认配置”后，系统会逐步生成默认多Agent流程。');
  }
}


const CANVAS_LAYOUT_DEVICE_STORAGE_KEY = 'zltx_device_config_primary';
const CANVAS_LAYOUT_STORAGE_KEY = 'zltx_agent_workflow_canvas_scroll_canvas';
const CANVAS_LAYOUT_MODE_KEY = 'zltx_agent_workflow_mode';
const WORKFLOW_LAYOUT_CANVAS_SIZE = { width: 2100, height: 980 };
const WORKFLOW_LAYOUT_DEFAULT_POSITIONS = {
  state_capture:       {left: 80,   top: 88,  width: 380},
  context_model:       {left: 920,  top: 88,  width: 470},
  vision_quality:      {left: 70,   top: 300, width: 300},
  localization_3d:     {left: 400,  top: 300, width: 300},
  placement_plan:      {left: 730,  top: 300, width: 300},
  hardware_interlock:  {left: 1060, top: 300, width: 300},
  safety_strategy:     {left: 1390, top: 300, width: 300},
  execution_constraint:{left: 1720, top: 300, width: 300},
  fusion_arbitration:  {left: 760,  top: 650, width: 430},
  control_task:        {left: 1270, top: 670, width: 350},
  archive:             {left: 1710, top: 670, width: 300}
};

function getStoredDevice(){
  try{
    const raw = localStorage.getItem(CANVAS_LAYOUT_DEVICE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    console.warn('设备参数读取失败', e);
    return null;
  }
}
function saveStoredDevice(data){
  const payload = {...data, deviceId:'001', connected:true, connectedAt:new Date().toISOString()};
  localStorage.setItem(CANVAS_LAYOUT_DEVICE_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}
function clearStoredDevice(){ localStorage.removeItem(CANVAS_LAYOUT_DEVICE_STORAGE_KEY); }
function isDeviceConnected(){
  const device = getStoredDevice();
  return Boolean(device && device.connected);
}

function applyPlatformVersionLabelsFromWorkflowLayout(){
  document.title = '智领铜行--人工智能机械臂多Agent智能决策平台 V3.2';
  document.querySelectorAll('.brand-ver').forEach(el => el.textContent = 'V3.2');
  const version = document.querySelector('.platform-card .pc-row:last-child strong');
  if(version) version.textContent = 'V3.2';
}

function ensureWorkflowCanvasTag(){
  const vp = getFlowViewport?.();
  if(!vp || vp.querySelector('#workflowCanvasSizeTag')) return;
  const tag = document.createElement('div');
  tag.id = 'workflowCanvasSizeTag';
  tag.className = 'workflow-canvas-size-tag';
  tag.textContent = '画布可滚动 · Agent信息完整展示';
  vp.appendChild(tag);
}

function applyDefaultWorkflowNodePosition(id){
  const node = getFlowNode?.(id);
  const pos = WORKFLOW_LAYOUT_DEFAULT_POSITIONS[id];
  if(!node || !pos) return;
  node.style.left = `${pos.left}px`;
  node.style.top = `${pos.top}px`;
  node.style.width = `${pos.width}px`;
  node.style.height = 'auto';
  node.style.maxHeight = 'none';
  node.dataset.positionLocked = 'true';
}

setupDefaultTopologyForRun = function(){
  document.querySelectorAll('#treeViewport .custom-agent').forEach(n => n.remove());
  MANUAL_WORKFLOW_BASE_IDS.forEach(id => {
    const node = getFlowNode(id);
    if(!node) return;
    node.classList.add('workflow-node-hidden');
    node.classList.remove('revealed-node','node-disabled','active');
    const btn = node.querySelector('.node-enable-toggle');
    if(btn) btn.textContent = '启用';
    applyDefaultWorkflowNodePosition(id);
  });
  flowConnections = DEFAULT_FLOW_CONNECTIONS.map(x => [...x]);
  const vp = getFlowViewport();
  if(vp){
    vp.classList.remove('workflow-canvas-empty');
    vp.scrollTo({left:0, top:0, behavior:'smooth'});
  }
  ensureWorkflowCanvasTag();
  applyArbitrationMode();
  redrawFlowCanvas();
};

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
  const col = visibleCount % 5;
  const row = Math.floor(visibleCount / 5);
  node.style.left = `${54 + col * 340}px`;
  node.style.top = `${72 + row * 225}px`;
  node.style.width = `${isArb ? 320 : 286}px`;
  node.style.height = 'auto';
  node.dataset.positionLocked = 'true';
  node.innerHTML = `<button type="button" class="node-enable-toggle" title="启用 / 停用这个节点" data-no-overlay="true">启用</button><button type="button" class="node-delete-btn" data-flow-action="remove-node" data-node-id="${escapeHtml(id)}" title="删除这个自定义节点" data-no-overlay="true">×</button><em>${data.icon}</em><h3>${escapeHtml(data.name)}</h3><span class="badge">WAITING</span><p>输入摘要：${escapeHtml(data.input)}</p><p>证据：${escapeHtml(data.evidence)}</p><p>输出结论：${escapeHtml(data.output)}</p><strong>风险 ${escapeHtml(data.risk)}</strong><small>${Number(data.latency || 0)}ms</small><div class="node-work-summary">${escapeHtml(data.role)}</div>`;
  viewport.appendChild(node);
  FLOW_NODE_META[id] = {...data, id};
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
  setCanvasHint(`已添加 ${data.name}。画布支持上下/左右滚动，请拖动节点并手动连线。`);
}

function setNodeExplicitPosition(node){
  if(!node || node.dataset.positionLocked === 'true') return;
  const left = node.offsetLeft;
  const top = node.offsetTop;
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
  node.style.height = 'auto';
  node.style.maxHeight = 'none';
  node.dataset.positionLocked = 'true';
}

function redrawFlowCanvas(){
  const viewport = getFlowViewport();
  const svg = ensureFlowCanvasSvg();
  if(!viewport || !svg) return;
  ensureWorkflowCanvasTag();
  let maxX = WORKFLOW_LAYOUT_CANVAS_SIZE.width;
  let maxY = WORKFLOW_LAYOUT_CANVAS_SIZE.height;
  visibleFlowNodes().forEach(node => {
    maxX = Math.max(maxX, node.offsetLeft + node.offsetWidth + 90);
    maxY = Math.max(maxY, node.offsetTop + node.offsetHeight + 90);
  });
  viewport.style.setProperty('--workflow-canvas-w', `${maxX}px`);
  viewport.style.setProperty('--workflow-canvas-h', `${maxY}px`);
  svg.style.width = `${maxX}px`;
  svg.style.height = `${maxY}px`;
  svg.setAttribute('viewBox', `0 0 ${maxX} ${maxY}`);
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

function persistFlowCanvas(){
  const nodes = visibleFlowNodes().filter(node => node.classList.contains('custom-agent')).map(node => ({
    id: node.dataset.node,
    custom: true,
    customType: node.dataset.customType || '',
    disabled: node.classList.contains('node-disabled'),
    left: node.style.left || '',
    top: node.style.top || '',
    width: node.style.width || '',
    html: node.innerHTML,
    className: node.className
  }));
  const payload = {mode: flowCanvasMode, nodes, connections: flowConnections, arbitrationMode:getArbitrationMode(), savedAt:new Date().toISOString()};
  localStorage.setItem(CANVAS_LAYOUT_STORAGE_KEY, JSON.stringify(payload));
}

function loadFlowCanvas(){
  try{
    const raw = localStorage.getItem(CANVAS_LAYOUT_STORAGE_KEY);
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
        node.style.width = record.width || node.style.width || '286px';
        node.style.height = 'auto';
        node.style.maxHeight = 'none';
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

try { flowCanvasMode = localStorage.getItem(CANVAS_LAYOUT_MODE_KEY) || 'manual'; } catch(e) { flowCanvasMode = 'manual'; }
function setCanvasMode(mode){
  flowCanvasMode = mode === 'auto' ? 'auto' : 'manual';
  localStorage.setItem(CANVAS_LAYOUT_MODE_KEY, flowCanvasMode);
  document.querySelectorAll('[data-flow-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.flowMode === flowCanvasMode));
  if(flowCanvasMode === 'manual'){
    setCanvasHint('当前为手动添加模式：画布默认空白，可上下/左右滚动。添加Agent后，节点信息会完整显示，不再被裁切。');
  }else{
    setCanvasHint('当前为Agent自动决策模式：点击“一键执行默认配置”后，系统会逐步生成默认多Agent流程；画布可滚动查看完整节点。');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    applyPlatformVersionLabelsFromWorkflowLayout();
    ensureWorkflowCanvasTag();
    redrawFlowCanvas();
    updateRunGate?.();
    const vp = getFlowViewport?.();
    vp?.addEventListener('scroll', () => requestAnimationFrame(redrawFlowCanvas), {passive:true});
  }, 520);
});


