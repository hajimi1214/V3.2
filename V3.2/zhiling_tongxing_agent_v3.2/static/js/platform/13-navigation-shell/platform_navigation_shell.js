const ROUTE_BASE_FLOW_IDS = ['state_capture','context_model','vision_quality','localization_3d','placement_plan','hardware_interlock','safety_strategy','execution_constraint','fusion_arbitration','control_task','archive'];
const PLATFORM_ROUTE_META = {
  workbench:{title:'决策工作台', tag:'DASHBOARD'},
  'tree-panel':{title:'多Agent决策树', tag:'FLOW CANVAS'},
  'agent-review':{title:'当前Agent审理台', tag:'AGENT REVIEW'},
  'state-snapshot':{title:'工业状态帧', tag:'STATE FRAME'},
  'model-output':{title:'算法模型输出', tag:'MODEL OUTPUT'},
  'model-import':{title:'模型导入', tag:'MODEL REGISTRY'},
  'governance-workflow':{title:'工业规范治理工作流', tag:'GOVERNANCE'},
  evidence:{title:'证据链表', tag:'EVIDENCE'},
  matrix:{title:'动作权限矩阵', tag:'POLICY MATRIX'},
  'control-task':{title:'控制任务中心', tag:'CONTROL TASK'},
  trace:{title:'决策Trace', tag:'TRACE LOG'},
  archive:{title:'报告归档', tag:'ARCHIVE'},
  alarm:{title:'告警中心', tag:'ALARM'},
  config:{title:'系统配置', tag:'SYSTEM CONFIG'},
  'agent-role-map':{title:'Agent分工与作用图谱', tag:'AGENT MAP'}
};

function getRouteTitle(id){
  return PLATFORM_ROUTE_META[id]?.title || moduleTitleMap?.[id] || id || '平台模块';
}
function setActiveNavigationItem(targetId){
  document.querySelectorAll('.nav-item,.nav-subitem').forEach(item => {
    item.classList.toggle('active', item.getAttribute('href') === `#${targetId}`);
  });
}
function ensurePlatformRouteShell(){
  const main = $('workbench');
  if(!main) return null;
  let tags = $('platform_navTagsBar');
  if(!tags){
    tags = document.createElement('section');
    tags.id = 'platform_navTagsBar';
    tags.className = 'platform_nav-tags-bar';
    tags.innerHTML = `<button type="button" class="platform_nav-home-tab active" data-platform_nav-route="workbench">首页</button><span id="platform_navCurrentTab">决策工作台</span>`;
    const status = main.querySelector('.status-bus');
    status?.insertAdjacentElement('afterend', tags);
  }
  let route = $('platform_navPageView');
  if(!route){
    route = document.createElement('section');
    route.id = 'platform_navPageView';
    route.className = 'platform_nav-page-view';
    route.innerHTML = `<div class="platform_nav-page-head"><div><span id="platform_navPageTag">DASHBOARD</span><h2 id="platform_navPageTitle">决策工作台</h2></div><button type="button" class="platform_nav-back-home" data-platform_nav-route="workbench">返回工作台</button></div><div id="platform_navPageBody" class="platform_nav-page-body"></div>`;
    tags?.insertAdjacentElement('afterend', route);
  }
  return route;
}
function ensureDashboardDrawerToggle(){
  const main = $('workbench');
  const detail = document.querySelector('.detail-grid');
  if(!main || !detail || $('moduleDrawerToggle')) return;
  const toggle = document.createElement('button');
  toggle.id = 'moduleDrawerToggle';
  toggle.className = 'module-drawer-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded','false');
  toggle.innerHTML = `<span>⌃</span><b>展开下方 4 个辅助板块</b><em>算法模型 / 告警 / Trace / 归档</em>`;
  detail.insertAdjacentElement('beforebegin', toggle);
  toggle.addEventListener('click', () => {
    const open = !document.body.classList.contains('dashboard-drawer-open');
    document.body.classList.toggle('dashboard-drawer-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.innerHTML = open ? `<span>⌄</span><b>收起下方 4 个辅助板块</b><em>保持主流程画布独立展示</em>` : `<span>⌃</span><b>展开下方 4 个辅助板块</b><em>算法模型 / 告警 / Trace / 归档</em>`;
    setTimeout(() => redrawFlowCanvas?.(), 80);
  });
}
function buildRouteView(targetId){
  if(targetId === 'config') return buildConfigCenterView?.() || document.createElement('div');
  if(targetId === 'device-config'){
    const view = buildDeviceConfigView?.() || document.createElement('div');
    setTimeout(() => bindDeviceConfigView?.(view), 0);
    return view;
  }
  if(targetId === 'model-import') return buildAgentModelImportView?.() || buildModuleDetailView?.(targetId) || document.createElement('div');
  if(targetId === 'governance-workflow') return buildGovernanceWorkflowDetailView?.() || buildGovernanceWorkflowView?.() || document.createElement('div');
  if(targetId === 'agent-role-map') return buildAgentRoleMapView?.() || document.createElement('div');
  if(targetId === 'workbench') return document.createElement('div');
  return buildModuleDetailView?.(targetId) || document.createElement('div');
}
function routeToModule(targetId='workbench', title){
  const route = ensurePlatformRouteShell();
  if(!route) return;
  const meta = PLATFORM_ROUTE_META[targetId] || {};
  const pageTitle = title || meta.title || getRouteTitle(targetId);
  $('platform_navCurrentTab') && ($('platform_navCurrentTab').textContent = pageTitle);
  $('platform_navPageTitle') && ($('platform_navPageTitle').textContent = pageTitle);
  $('platform_navPageTag') && ($('platform_navPageTag').textContent = meta.tag || 'MODULE');
  document.querySelector('.platform_nav-home-tab')?.classList.toggle('active', targetId === 'workbench');
  document.querySelector('#platform_navTagsBar span')?.classList.toggle('active', targetId !== 'workbench');
  setActiveNavigationItem(targetId);
  document.body.classList.remove('platform_nav-page-open','platform_nav-tree-page');
  route.setAttribute('aria-hidden','true');
  if(targetId === 'workbench'){
    route.classList.remove('open');
    setTimeout(() => redrawFlowCanvas?.(), 80);
    return;
  }
  if(targetId === 'tree-panel'){
    document.body.classList.add('platform_nav-tree-page');
    document.body.classList.remove('compact-workflow-flow');
    route.classList.remove('open');
    route.setAttribute('aria-hidden','true');
    try{
      setCanvasMode?.('manual');
      setEmptyManualCanvas?.(true);
      redrawFlowCanvas?.();
      getFlowViewport?.()?.scrollTo({left:0, top:0, behavior:'auto'});
    }catch(e){ console.warn('V3.2树状图页面空白初始化失败', e); }
    return;
  }
  const body = $('platform_navPageBody');
  if(body){
    body.innerHTML = '';
    body.appendChild(buildRouteView(targetId));
  }
  document.body.classList.add('platform_nav-page-open');
  route.classList.add('open');
  route.setAttribute('aria-hidden','false');
}

function shouldBypassPanelClick(e){
  return e.target.closest('button,a,input,select,textarea,pre,[data-action],[data-flow-action],.tree-node,.tree-viewport,.agent-component-drawer,.agent-component-drawer-mask,.report-print-modal,.device-connect-modal,[data-no-overlay]');
}
window.addEventListener('click', (e) => {
  const nav = e.target.closest('.nav-item,.nav-subitem,[data-platform_nav-route]');
  if(nav){
    const href = nav.dataset.platform_navRoute ? `#${nav.dataset.platform_navRoute}` : nav.getAttribute('href');
    if(href && href.startsWith('#')){
      e.preventDefault();
      e.stopImmediatePropagation();
      const targetId = href.slice(1) || 'workbench';
      routeToModule(targetId, getRouteTitle(targetId));
    }
    return;
  }
  const direct = e.target.closest('[data-module-target]');
  if(direct){
    const id = direct.dataset.moduleTarget;
    e.preventDefault();
    e.stopImmediatePropagation();
    routeToModule(id, getRouteTitle(id));
    return;
  }
  const panel = e.target.closest('main .panel[id]');
  if(panel && !shouldBypassPanelClick(e)){
    e.preventDefault();
    e.stopImmediatePropagation();
    routeToModule(panel.id, getRouteTitle(panel.id));
  }
}, true);

const openModuleOverlayBeforeRouteShell = typeof openModuleOverlay === 'function' ? openModuleOverlay : null;
if(openModuleOverlayBeforeRouteShell){
  openModuleOverlay = function(targetId, title){
    const routedIds = new Set(Object.keys(PLATFORM_ROUTE_META).concat(['device-config']));
    if(routedIds.has(targetId)){
      routeToModule(targetId, title || getRouteTitle(targetId));
      return;
    }
    return openModuleOverlayBeforeRouteShell(targetId, title);
  };
}

function applyCompactFlowLayout(){
  const vp = getFlowViewport?.();
  if(!vp) return {width:1280, height:540};
  document.body.classList.add('compact-workflow-flow');
  const width = Math.max(1080, vp.clientWidth - 18);
  const height = Math.max(500, Math.min(620, vp.clientHeight - 8 || 540));
  vp.style.setProperty('--workflow-canvas-w', `${width}px`);
  vp.style.setProperty('--workflow-canvas-h', `${height}px`);
  const topMain = 48;
  const topAgents = Math.min(232, Math.max(190, height * .39));
  const topFinal = Math.min(410, Math.max(344, height * .72));
  const expertGap = 18;
  const expertW = Math.max(148, Math.min(205, (width - 64 - expertGap * 5) / 6));
  const expertLeft0 = Math.max(26, (width - (expertW * 6 + expertGap * 5)) / 2);
  const positions = {
    state_capture: {left: Math.max(34, width * .07), top: topMain, width: Math.min(280, width * .22)},
    context_model: {left: Math.max(width * .48, 430), top: topMain, width: Math.min(370, width * .31)},
    fusion_arbitration: {left: Math.max(280, width * .36), top: topFinal, width: Math.min(340, width * .28)},
    control_task: {left: Math.max(650, width * .66), top: topFinal, width: Math.min(270, width * .22)},
    archive: {left: Math.max(880, width * .84), top: topFinal, width: Math.min(210, width * .16)}
  };
  ['vision_quality','localization_3d','placement_plan','hardware_interlock','safety_strategy','execution_constraint'].forEach((id, idx) => {
    positions[id] = {left: expertLeft0 + idx * (expertW + expertGap), top: topAgents, width: expertW};
  });
  Object.entries(positions).forEach(([id, pos]) => {
    const node = getFlowNode?.(id);
    if(!node) return;
    node.classList.remove('workflow-node-hidden','future-node','node-disabled');
    node.classList.add('revealed-node','flow-canvas-node');
    node.style.left = `${Math.round(pos.left)}px`;
    node.style.top = `${Math.round(pos.top)}px`;
    node.style.width = `${Math.round(pos.width)}px`;
    node.style.height = 'auto';
    node.style.maxHeight = 'none';
    node.dataset.positionLocked = 'true';
    const btn = node.querySelector('.node-enable-toggle');
    if(btn) btn.textContent = '启用';
  });
  const svg = ensureFlowCanvasSvg?.();
  if(svg){
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  return {width, height};
}

function drawRouteFlowLines(width, height){
  const svg = ensureFlowCanvasSvg?.();
  if(!svg) return;
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  Array.from(svg.querySelectorAll('path.flow-canvas-line')).forEach(el => el.remove());
  flowConnections = normalizeFlowConnections(DEFAULT_FLOW_CONNECTIONS.map(x => [...x]));
  flowConnections.forEach(([from,to]) => {
    const a = getFlowNode?.(from); const b = getFlowNode?.(to);
    if(!a || !b) return;
    const p1 = nodeCenterInViewport(a); const p2 = nodeCenterInViewport(b);
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    const isTop = Math.abs(p1.y-p2.y) < 42;
    const midY = (p1.y + p2.y) / 2;
    const d = isTop ? `M ${p1.x} ${p1.y} C ${(p1.x+p2.x)/2} ${p1.y}, ${(p1.x+p2.x)/2} ${p2.y}, ${p2.x} ${p2.y}` : `M ${p1.x} ${p1.y} V ${midY} H ${p2.x} V ${p2.y}`;
    path.setAttribute('d', d);
    path.setAttribute('marker-end', 'url(#flowCanvasArrow)');
    path.dataset.from = from; path.dataset.to = to;
    path.classList.add('flow-canvas-line','route-flow-line');
    if(a.classList.contains('active') || b.classList.contains('active')) path.classList.add('active-line');
    svg.appendChild(path);
  });
}

const redrawFlowCanvasBeforeRouteShell = typeof redrawFlowCanvas === 'function' ? redrawFlowCanvas : null;
if(redrawFlowCanvasBeforeRouteShell){
  redrawFlowCanvas = function(){
    const vp = getFlowViewport?.();
    const useCompact = Boolean(vp && (document.body.classList.contains('compact-workflow-flow') || flowCanvasMode === 'auto'));
    if(useCompact){
      const size = applyCompactFlowLayout();
      drawRouteFlowLines(size.width, size.height);
      updateEmptyCanvasState?.();
      return;
    }
    return redrawFlowCanvasBeforeRouteShell();
  };
}

const setupDefaultTopologyBeforeRouteShell = typeof setupDefaultTopologyForRun === 'function' ? setupDefaultTopologyForRun : null;
if(setupDefaultTopologyBeforeRouteShell){
  setupDefaultTopologyForRun = function(){
    document.querySelectorAll('#treeViewport .custom-agent').forEach(n => n.remove());
    ROUTE_BASE_FLOW_IDS.forEach(id => {
      const node = getFlowNode?.(id);
      if(!node) return;
      node.classList.remove('workflow-node-hidden','future-node','node-disabled','active');
      node.classList.add('revealed-node','flow-canvas-node');
      const btn = node.querySelector('.node-enable-toggle');
      if(btn) btn.textContent = '启用';
    });
    flowConnections = DEFAULT_FLOW_CONNECTIONS.map(x => [...x]);
    const vp = getFlowViewport?.();
    if(vp){
      vp.classList.remove('workflow-canvas-empty');
      vp.scrollTo({left:0, top:0, behavior:'auto'});
    }
    document.body.classList.add('compact-workflow-flow');
    applyArbitrationMode?.();
    applyCompactFlowLayout();
    redrawFlowCanvas?.();
    setCanvasHint?.('自动决策拓扑已完整展开：主干流程、六路专家并行审查、融合仲裁、控制任务、报告归档全部在同一画布内显示。');
  };
}

const setCanvasModeBeforeRouteShell = typeof setCanvasMode === 'function' ? setCanvasMode : null;
if(setCanvasModeBeforeRouteShell){
  setCanvasMode = function(mode){
    setCanvasModeBeforeRouteShell(mode);
    if(mode === 'auto'){
      document.body.classList.add('compact-workflow-flow');
      setTimeout(() => { setupDefaultTopologyForRun?.(); redrawFlowCanvas?.(); }, 20);
    }else{
      document.body.classList.remove('compact-workflow-flow');
    }
  };
}

document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-flow-action]')?.dataset.flowAction;
  if(action === 'mode-auto') setTimeout(() => { setupDefaultTopologyForRun?.(); redrawFlowCanvas?.(); }, 30);
  if(action === 'mode-manual') setTimeout(() => { document.body.classList.remove('compact-workflow-flow'); }, 30);
  if(action === 'run-default') setTimeout(() => { document.body.classList.add('compact-workflow-flow'); redrawFlowCanvas?.(); }, 60);
}, true);

function applyPlatformVersionLabelsFromRouteShell(){
  document.title = '智领铜行--人工智能机械臂多Agent智能决策平台 V3.2';
  document.querySelectorAll('.brand-ver').forEach(el => el.textContent = 'V3.2');
  const version = document.querySelector('.platform-card .pc-row:last-child strong');
  if(version) version.textContent = 'V3.2.0 Build 20260518';
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    applyPlatformVersionLabelsFromRouteShell();
    ensurePlatformRouteShell();
    ensureDashboardDrawerToggle();
    document.body.classList.add('platform_nav-admin-shell');
    document.body.classList.remove('dashboard-drawer-open');
    // V3.2 默认进入平台时保持“未连接设备 + 空白决策树”，不自动展开示例拓扑。
    try{
      localStorage.removeItem(MODEL_RUNTIME_FLOW_MODE_KEY);
      localStorage.removeItem(MODEL_RUNTIME_FLOW_STORAGE_KEY);
    }catch(e){}
    setCanvasMode?.('manual');
    setEmptyManualCanvas?.(true);
    routeToModule('workbench', '决策工作台');
    redrawFlowCanvas?.();
  }, 1150);
});

/* V3.2: Agent decision detail also opens as an inline page, not a modal overlay. */
const openAgentDecisionDetailBeforeRouteShell = typeof openAgentDecisionDetail === 'function' ? openAgentDecisionDetail : null;
if(openAgentDecisionDetailBeforeRouteShell){
  openAgentDecisionDetail = function(index){
    const route = ensurePlatformRouteShell?.();
    const body = $('platform_navPageBody');
    const agent = AGENT_ROLE_DETAILS?.[index] || AGENT_ROLE_DETAILS?.[0];
    if(!route || !body || !agent) return openAgentDecisionDetailBeforeRouteShell(index);
    document.body.classList.remove('platform_nav-tree-page');
    document.body.classList.add('platform_nav-page-open');
    route.classList.add('open');
    route.setAttribute('aria-hidden','false');
    $('platform_navCurrentTab') && ($('platform_navCurrentTab').textContent = `${agent.name} / 决策详情`);
    $('platform_navPageTitle') && ($('platform_navPageTitle').textContent = `${agent.name} / 决策详情`);
    $('platform_navPageTag') && ($('platform_navPageTag').textContent = 'AGENT DETAIL');
    setActiveNavigationItem?.('agent-review');
    body.innerHTML = '';
    body.appendChild(buildAgentDecisionDetailView(index));
  };
}



const NAV_DEVICE_STORAGE_KEY = 'zltx_device_config_default_manual';
const DEVICE_ACTIVE_STORAGE_KEY = 'zhiling_tongxing_device_config_active';
const NAV_FLOW_MODE_KEY = 'zltx_agent_workflow_mode_empty_default';
const NAV_FLOW_STORAGE_KEY = 'zltx_agent_workflow_canvas_empty_default';
const NAV_CACHE_CLEAN_KEYS = [
  'zltx_device_config_primary','zltx_device_config_primary','zltx_device_config_primary','zltx_device_config_primary','zltx_device_config_primary',
  'zltx_agent_workflow_mode','zltx_agent_workflow_mode','zltx_agent_workflow_mode','zltx_agent_workflow_mode',
  'zltx_agent_workflow_canvas','zltx_agent_workflow_canvas_empty_manual','zltx_agent_workflow_canvas_layout','zltx_agent_workflow_canvas_scroll_canvas','zltx_agent_workflow_canvas_empty_manual'
];
try{
  // 首次进入V3.2时隔离旧版本缓存，避免旧包把设备显示为已连接、把示例树直接铺满。
  NAV_CACHE_CLEAN_KEYS.filter(k => !k.includes('device_config')).forEach(k => localStorage.removeItem(k));
  if(!localStorage.getItem(NAV_FLOW_MODE_KEY)) localStorage.setItem(NAV_FLOW_MODE_KEY, 'manual');
}catch(e){}

const LOCALIZED_STATUS_TEXT = {
  NO_DEVICE:'未连接', WAIT_DEVICE:'等待设备', ONLINE:'在线', SYNCED:'已同步', HEALTHY:'健康', TRUE:'就绪', FALSE:'未就绪',
  STANDBY:'待机', RUNNING:'运行中', DONE:'完成', WAITING:'等待', PASS:'通过', LIMITED:'受限', BLOCKED:'阻断', LOCKED:'锁定', BLOCK:'阻断',
  LOW:'低风险', MEDIUM:'中风险', HIGH:'高风险'
};
function localizedStatusText(value){ return LOCALIZED_STATUS_TEXT[String(value ?? '').trim()] || String(value ?? ''); }
function rawStatusText(value){
  const s = String(value ?? '').trim();
  const hit = Object.entries(LOCALIZED_STATUS_TEXT).find(([, cn]) => cn === s);
  return hit ? hit[0] : s;
}
function localizeVisibleStatuses(){
  document.querySelectorAll('#agentBus,#plcState,#sensorState,#agvState,#crcState,#armState,.tree-node .badge,.matrix-table td,.agent-review span,.status-pill').forEach(el => {
    const t = (el.textContent || '').trim();
    if(LOCALIZED_STATUS_TEXT[t]) el.textContent = LOCALIZED_STATUS_TEXT[t];
  });
}
function setStatusBusLabels(){
  const labels = [
    ['plcState','PLC链路'], ['sensorState','传感器总线'], ['agvState','AGV链路'], ['crcState','CRC校验'], ['armState','机械臂就绪'], ['agentBus','Agent总线']
  ];
  labels.forEach(([id, label]) => {
    const el = document.getElementById(id);
    const span = el?.closest('span');
    if(span && span.firstChild && span.firstChild.nodeType === Node.TEXT_NODE) span.firstChild.textContent = `${label}：`;
  });
}

function getStoredDevice(){
  try{
    const raw = localStorage.getItem(NAV_DEVICE_STORAGE_KEY) || localStorage.getItem(DEVICE_ACTIVE_STORAGE_KEY);
    if(!raw) return null;
    const device = JSON.parse(raw);
    if(device && device.connected && !localStorage.getItem(NAV_DEVICE_STORAGE_KEY)){
      localStorage.setItem(NAV_DEVICE_STORAGE_KEY, JSON.stringify(device));
    }
    return device;
  }catch(e){ console.warn('设备参数读取失败', e); return null; }
}
function saveStoredDevice(data){
  const existed = getStoredDevice();
  const payload = {
    ...data,
    deviceId:'001',
    connected:true,
    connectedAt: existed?.connectedAt || new Date().toISOString(),
    lastConfirmedAt: new Date().toISOString()
  };
  localStorage.setItem(NAV_DEVICE_STORAGE_KEY, JSON.stringify(payload));
  localStorage.setItem(DEVICE_ACTIVE_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}
function clearStoredDevice(){
  localStorage.removeItem(NAV_DEVICE_STORAGE_KEY);
  localStorage.removeItem(DEVICE_ACTIVE_STORAGE_KEY);
  NAV_CACHE_CLEAN_KEYS.filter(k => k.includes('device_config')).forEach(k => localStorage.removeItem(k));
}
function isDeviceConnected(){
  const device = getStoredDevice();
  return Boolean(device && device.connected);
}
function setBusVisual(dotId, textId, dotClass, text){
  const dot = $(dotId);
  const el = $(textId);
  const raw = rawStatusText(text);
  if(dot){ dot.className = 'dot ' + dotClass; }
  if(el){
    el.dataset.state = raw;
    el.textContent = localizedStatusText(raw);
    el.className = raw === 'NO_DEVICE' ? 'bus-off' : 'bus-on';
  }
}
function applyDeviceConnectionVisuals(connected){
  setStatusBusLabels();
  setBusVisual('plcDot','plcState', connected ? 'green' : 'gray', connected ? 'ONLINE' : 'NO_DEVICE');
  setBusVisual('sensorDot','sensorState', connected ? 'green' : 'gray', connected ? 'SYNCED' : 'NO_DEVICE');
  setBusVisual('agvDot','agvState', connected ? 'green' : 'gray', connected ? 'ONLINE' : 'NO_DEVICE');
  setBusVisual('crcDot','crcState', connected ? 'green' : 'gray', connected ? 'HEALTHY' : 'NO_DEVICE');
  setBusVisual('armDot','armState', connected ? 'cyan' : 'gray', connected ? 'TRUE' : 'NO_DEVICE');
}
function updateRunGate(){
  const btn = $('startBtn');
  const connected = isDeviceConnected();
  const task = $('currentTask');
  const bus = $('agentBus');
  const focus = $('focusLabel');
  applyDeviceConnectionVisuals(connected);
  if(task) task.textContent = connected ? 'PICK_AND_PLACE' : '无设备连接';
  if(focus && !connected && !running) focus.textContent = '无设备连接';
  if(bus){
    const previous = bus.dataset.state || rawStatusText(bus.textContent);
    const next = connected ? (running ? 'RUNNING' : (previous === 'DONE' ? 'DONE' : 'STANDBY')) : 'NO_DEVICE';
    bus.dataset.state = next;
    bus.textContent = localizedStatusText(next);
  }
  if(!btn) return;
  if(connected){
    btn.classList.remove('gated');
    btn.title = '设备已接入，可以启动多Agent决策';
    if(!running && !btn.dataset.completed) btn.innerHTML = '<span>▶</span>采集工业状态帧并启动决策';
  } else {
    btn.classList.add('gated');
    btn.title = '暂无设备连接，请先进入系统配置完成设备参数接入';
    if(!running) btn.innerHTML = '<span>⚠</span>暂无设备连接';
  }
  localizeVisibleStatuses();
}

const setStatusBeforeEmptyFlow = typeof setStatus === 'function' ? setStatus : null;
if(setStatusBeforeEmptyFlow){
  setStatus = function(nodeId, status){
    setStatusBeforeEmptyFlow(nodeId, status);
    const node = nodeEl?.(nodeId);
    const badge = node?.querySelector('.badge');
    if(badge) badge.textContent = localizedStatusText(status);
  };
}

const setCanvasModeBeforeEmptyFlow = typeof setCanvasMode === 'function' ? setCanvasMode : null;
if(setCanvasModeBeforeEmptyFlow){
  setCanvasMode = function(mode){
    flowCanvasMode = mode === 'auto' ? 'auto' : 'manual';
    try{ localStorage.setItem(NAV_FLOW_MODE_KEY, flowCanvasMode); }catch(e){}
    document.querySelectorAll('[data-flow-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.flowMode === flowCanvasMode));
    if(flowCanvasMode === 'manual'){
      document.body.classList.remove('compact-workflow-flow');
      setCanvasHint?.('当前为手动添加模式：画布默认空白。可先添加Agent/仲裁组件，再连线定义依赖。');
    }else{
      document.body.classList.remove('empty-workflow-flow');
      document.body.classList.add('compact-workflow-flow');
      setCanvasHint?.('当前为Agent自动决策模式：系统会展开默认多Agent流程，并显示完整连线。');
    }
  };
}

function emptyDecisionCanvas(){
  document.body.classList.add('empty-workflow-flow');
  document.body.classList.remove('compact-workflow-flow');
  try{
    localStorage.setItem(NAV_FLOW_MODE_KEY, 'manual');
    localStorage.removeItem(NAV_FLOW_STORAGE_KEY);
  }catch(e){}
  flowCanvasMode = 'manual';
  setEmptyManualCanvas?.(true);
  const svg = ensureFlowCanvasSvg?.();
  if(svg) Array.from(svg.querySelectorAll('path.flow-canvas-line')).forEach(el => el.remove());
  const vp = getFlowViewport?.();
  vp?.classList.add('workflow-canvas-empty');
  localizeVisibleStatuses();
}

const redrawFlowCanvasBeforeEmptyFlow = typeof redrawFlowCanvas === 'function' ? redrawFlowCanvas : null;
if(redrawFlowCanvasBeforeEmptyFlow){
  redrawFlowCanvas = function(){
    if(document.body.classList.contains('empty-workflow-flow') && flowCanvasMode !== 'auto'){
      const svg = ensureFlowCanvasSvg?.();
      const vp = getFlowViewport?.();
      if(svg && vp){
        const w = Math.max(980, vp.clientWidth || 980);
        const h = Math.max(360, vp.clientHeight || 420);
        svg.style.width = `${w}px`;
        svg.style.height = `${h}px`;
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        Array.from(svg.querySelectorAll('path.flow-canvas-line')).forEach(el => el.remove());
      }
      updateEmptyCanvasState?.();
      return;
    }
    redrawFlowCanvasBeforeEmptyFlow();
    localizeVisibleStatuses();
  };
}

const routeToModuleBeforeEmptyFlow = typeof routeToModule === 'function' ? routeToModule : null;
if(routeToModuleBeforeEmptyFlow){
  routeToModule = function(targetId='workbench', title){
    if(targetId === 'tree-panel'){
      const route = ensurePlatformRouteShell?.();
      const meta = PLATFORM_ROUTE_META?.[targetId] || {};
      $('platform_navCurrentTab') && ($('platform_navCurrentTab').textContent = title || meta.title || '多Agent决策树');
      $('platform_navPageTitle') && ($('platform_navPageTitle').textContent = title || meta.title || '多Agent决策树');
      $('platform_navPageTag') && ($('platform_navPageTag').textContent = meta.tag || 'FLOW CANVAS');
      setActiveNavigationItem?.(targetId);
      document.body.classList.remove('platform_nav-page-open');
      document.body.classList.add('platform_nav-tree-page');
      route?.classList.remove('open');
      route?.setAttribute('aria-hidden','true');
      emptyDecisionCanvas();
      return;
    }
    return routeToModuleBeforeEmptyFlow(targetId, title);
  };
}

document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-flow-action]')?.dataset.flowAction;
  if(action === 'mode-auto' || action === 'run-default'){
    document.body.classList.remove('empty-workflow-flow');
    document.body.classList.add('compact-workflow-flow');
    setTimeout(() => { setupDefaultTopologyForRun?.(); redrawFlowCanvas?.(); }, 40);
  }
  if(action === 'mode-manual' || action === 'clear-canvas'){
    setTimeout(() => emptyDecisionCanvas(), 40);
  }
}, true);

function applyPlatformVersionLabelsFromEmptyFlow(){
  document.title = '智领铜行--人工智能机械臂多Agent智能决策平台 V3.2';
  document.querySelectorAll('.brand-ver').forEach(el => el.textContent = 'V3.2');
  const version = document.querySelector('.platform-card .pc-row:last-child strong');
  if(version) version.textContent = 'V3.2.0 Build 20260518';
  setStatusBusLabels();
  updateRunGate();
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    applyPlatformVersionLabelsFromEmptyFlow();
    emptyDecisionCanvas();
    routeToModule?.('workbench', '决策工作台');
    updateRunGate();
    localizeVisibleStatuses();
  }, 1450);
  const obs = new MutationObserver(() => localizeVisibleStatuses());
  setTimeout(() => {
    const root = document.querySelector('.main-stage') || document.body;
    obs.observe(root, {subtree:true, childList:true, characterData:true});
  }, 300);
});


const NAVIGATION_SHELL_VERSION = 'V3.2';
const NAVIGATION_SHELL_BUILD = 'V3.2.0 Build 20260518';

function setIndustrialStateFrameMedia(connected = isDeviceConnected?.()){
  const isOn = Boolean(connected);
  document.querySelectorAll('[data-state-frame-root]').forEach(root => {
    root.classList.toggle('state-video-ready', isOn);
    const panel = root.closest('.state-frame-panel,#state-snapshot,.focused-clone-panel');
    panel?.classList.toggle('state-device-connected', isOn);
    const label = panel?.querySelector('[data-state-frame-label], .panel-head span');
    if(label) label.textContent = isOn ? '实时视频循环' : '设备未连接';
    const video = root.querySelector('[data-state-video]');
    if(video){
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      if(isOn){
        video.play().catch(() => {});
      }else{
        video.pause();
        try{ video.currentTime = 0; }catch(e){}
      }
    }
    root.querySelectorAll('.state-frame-metrics b[data-online-value]').forEach(item => {
      item.textContent = isOn ? item.dataset.onlineValue : '未连接';
      item.classList.toggle('online', isOn);
      item.classList.toggle('offline', !isOn);
    });
  });
}

const updateRunGateBeforeStateMedia = typeof updateRunGate === 'function' ? updateRunGate : null;
if(updateRunGateBeforeStateMedia){
  updateRunGate = function(){
    const ret = updateRunGateBeforeStateMedia.apply(this, arguments);
    setIndustrialStateFrameMedia(isDeviceConnected?.());
    return ret;
  };
}

const routeToModuleBeforeStateMedia = typeof routeToModule === 'function' ? routeToModule : null;
if(routeToModuleBeforeStateMedia){
  routeToModule = function(targetId='workbench', title){
    const ret = routeToModuleBeforeStateMedia.apply(this, arguments);
    setTimeout(() => setIndustrialStateFrameMedia(isDeviceConnected?.()), 60);
    return ret;
  };
}

function applyPlatformVersionLabelsFromStateMedia(){
  document.title = '智领铜行--人工智能机械臂多Agent智能决策平台 V3.2';
  document.querySelectorAll('.brand-ver').forEach(el => el.textContent = NAVIGATION_SHELL_VERSION);
  const version = document.querySelector('.platform-card .pc-row:last-child strong');
  if(version) version.textContent = NAVIGATION_SHELL_BUILD;
  setIndustrialStateFrameMedia(isDeviceConnected?.());
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    applyPlatformVersionLabelsFromStateMedia();
    updateRunGate?.();
    setIndustrialStateFrameMedia(isDeviceConnected?.());
  }, 1700);
  const stateFrameObserver = new MutationObserver(() => setIndustrialStateFrameMedia(isDeviceConnected?.()));
  setTimeout(() => {
    const root = document.querySelector('.main-stage') || document.body;
    stateFrameObserver.observe(root, {subtree:true, childList:true});
  }, 900);
});


