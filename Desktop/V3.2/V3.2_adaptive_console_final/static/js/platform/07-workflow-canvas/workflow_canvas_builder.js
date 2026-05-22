const FLOW_STORAGE_KEY = 'zltx_agent_workflow_canvas';
let flowConnections = [];
let connectMode = false;
let connectSource = null;
let canvasExecutionTimer = null;
let flowCanvasInitialized = false;
let customAgentCounter = 0;

const AGENT_CATALOG = [
  {id:'algorithm_adapter', name:'算法输出接入Agent', layer:'接入层', role:'接入YOLO、SGBM、AGV定位和图像修复结果', icon:'▧', risk:'LOW', latency:36, status:'PASS', input:'YOLO/SGBM/AGV模型输出', evidence:'MODEL_PAYLOAD_PASS', output:'标准化算法载荷'},
  {id:'sensor_sync', name:'传感器同步Agent', layer:'接入层', role:'校验相机、点云、PLC帧时间戳是否对齐', icon:'⌁', risk:'LOW', latency:29, status:'PASS', input:'Camera/PointCloud/PLC时间戳', evidence:'SYNC_JITTER_0.8ms', output:'传感器同步通过'},
  {id:'gripper_pressure', name:'夹具压力Agent', layer:'执行层', role:'评估末端夹具压力、真空吸附和释放窗口', icon:'◍', risk:'MEDIUM', latency:74, status:'LIMITED', input:'夹具压力/吸附状态', evidence:'VACUUM_86%', output:'夹具压力受限放行'},
  {id:'motor_temp', name:'电机温度Agent', layer:'硬件层', role:'检查关节电机温升、伺服驱动器负载和过热风险', icon:'♨', risk:'LOW', latency:45, status:'PASS', input:'ServoTemp/J1-J6', evidence:'MAX_TEMP_47C', output:'电机温度正常'},
  {id:'network_latency', name:'网络延迟Agent', layer:'通信层', role:'监测控制链路RTT、丢包和消息队列积压', icon:'↯', risk:'LOW', latency:22, status:'PASS', input:'TCP/ROS2/PLC链路', evidence:'RTT_P99_12ms', output:'链路延迟可控'},
  {id:'energy_efficiency', name:'能耗评估Agent', layer:'优化层', role:'对候选轨迹进行能耗、节拍和设备磨损评估', icon:'△', risk:'LOW', latency:91, status:'PASS', input:'候选轨迹/电流曲线', evidence:'ENERGY_SCORE_0.87', output:'推荐低能耗轨迹'},
  {id:'quality_recheck', name:'质检复核Agent', layer:'复核层', role:'复核抓取前后视觉差异，防止误抓和漏抓', icon:'◐', risk:'MEDIUM', latency:118, status:'PASS', input:'抓取前后图像ROI', evidence:'DIFF_PASS_0.93', output:'质检复核通过'},
  {id:'human_override', name:'人工复核Agent', layer:'复核层', role:'当风险超过阈值时生成待人工确认任务', icon:'♙', risk:'MEDIUM', latency:0, status:'WAITING', input:'仲裁风险/冲突项', evidence:'WAIT_OPERATOR', output:'等待人工复核'},
  {id:'beat_optimizer', name:'产线节拍Agent', layer:'优化层', role:'结合产线节拍、AGV到位时间和机械臂占用率做调度优化', icon:'▤', risk:'LOW', latency:66, status:'PASS', input:'Beat/AGV ETA/Queue', evidence:'BEAT_MARGIN_1.8s', output:'节拍满足'},
  {id:'collision_predict', name:'碰撞预测Agent', layer:'安全层', role:'基于数字孪生模型预测轨迹碰撞和禁区穿越', icon:'◬', risk:'HIGH', latency:135, status:'BLOCKED', input:'路径/安全区/工装模型', evidence:'ZONE_MARGIN_18mm', output:'局部路径需重规划'}
];

const FLOW_NODE_META = {
  state_capture:{name:'工业状态帧采集', layer:'输入层', role:'采集相机、AGV、PLC和联锁状态帧', icon:'▣', risk:'LOW', latency:12, status:'PASS', input:'双目相机+AGV视觉+PLC联锁', evidence:'FRAME_CRC_PASS', output:'工业状态帧已生成'},
  context_model:{name:'任务上下文建模 / 流程规划', layer:'规划层', role:'理解任务工况，拆分专家并行审查流程', icon:'⌘', risk:'LOW', latency:18, status:'PASS', input:'状态帧+算法模型载荷', evidence:'TASK_CONTEXT_PASS', output:'任务上下文已建模'},
  vision_quality:{name:'视觉质量Agent', layer:'专家层', role:'判断目标检测质量、遮挡和图像可用性', icon:'◉', risk:'LOW', latency:46, status:'PASS', input:'相机帧#1245', evidence:'YOLO_CONF_0.98', output:'视觉质量合格'},
  localization_3d:{name:'三维定位Agent', layer:'专家层', role:'校验SGBM深度、点云和抓取位姿', icon:'◇', risk:'LOW', latency:98, status:'PASS', input:'点云#0891', evidence:'RMSE_0.21mm', output:'定位精度达标'},
  placement_plan:{name:'放置规划Agent', layer:'专家层', role:'计算AGV放置点、机械臂轨迹和候选路径', icon:'◎', risk:'MEDIUM', latency:312, status:'PASS', input:'工件姿态+目标位', evidence:'PATH_FEASIBLE_92%', output:'第3候选路径可执行'},
  hardware_interlock:{name:'硬件联锁Agent', layer:'专家层', role:'检查安全门、光栅、急停、气压和PLC联锁', icon:'▣', risk:'MEDIUM', latency:127, status:'LIMITED', input:'I/O状态+联锁链', evidence:'DOOR_DELAY_CONFIRM', output:'降级策略可行'},
  safety_strategy:{name:'安全策略Agent', layer:'专家层', role:'合成安全策略和风险控制边界', icon:'◈', risk:'LOW', latency:88, status:'PASS', input:'风险评估请求', evidence:'POLICY_CONF_0.95', output:'风险可控'},
  execution_constraint:{name:'执行约束Agent', layer:'专家层', role:'检查关节扭矩、负载和速度边界', icon:'⌁', risk:'HIGH', latency:64, status:'BLOCKED', input:'机器人关节预检', evidence:'J2_TORQUE_MARGIN_LOW', output:'原速执行受阻'},
  fusion_arbitration:{name:'融合仲裁 / 最终仲裁Agent', layer:'仲裁层', role:'汇总多Agent证据，权重投票和安全否决', icon:'⚖', risk:'MEDIUM', latency:188, status:'LIMITED', input:'专家Agent结果集合', evidence:'3 PASS / 1 LIMITED / 1 BLOCKED', output:'PICK_AND_PLACE_LIMITED'},
  control_task:{name:'控制任务生成', layer:'控制层', role:'根据仲裁结果生成控制JSON和权限校验', icon:'⚙', risk:'MEDIUM', latency:72, status:'PASS', input:'仲裁动作建议', evidence:'POLICY_MATRIX_PASS', output:'控制任务JSON已生成'},
  archive:{name:'报告归档', layer:'归档层', role:'固化Trace、证据链、设备参数和PDF报告', icon:'▤', risk:'LOW', latency:58, status:'PASS', input:'任务执行结果', evidence:'TRACE_15_ITEMS', output:'报告已归档'}
};

const DEFAULT_FLOW_CONNECTIONS = [
  ['state_capture','context_model'],
  ['context_model','vision_quality'],['context_model','localization_3d'],['context_model','placement_plan'],['context_model','hardware_interlock'],['context_model','safety_strategy'],['context_model','execution_constraint'],
  ['vision_quality','fusion_arbitration'],['localization_3d','fusion_arbitration'],['placement_plan','fusion_arbitration'],['hardware_interlock','fusion_arbitration'],['safety_strategy','fusion_arbitration'],['execution_constraint','fusion_arbitration'],
  ['fusion_arbitration','control_task'],['control_task','archive']
];

function getFlowViewport(){ return $('treeViewport'); }
function allFlowNodes(){ return Array.from(document.querySelectorAll('#treeViewport .tree-node[data-node]')); }
function getFlowNode(id){ return document.querySelector(`#treeViewport .tree-node[data-node="${CSS.escape(id)}"]`); }
function getNodeMeta(id){ return FLOW_NODE_META[id] || AGENT_CATALOG.find(a => a.id === id) || {name:id, layer:'自定义层', role:'用户自定义Agent', icon:'+', risk:'LOW', latency:70, status:'PASS', input:'自定义输入', evidence:'CUSTOM_AGENT', output:'自定义输出'}; }

function normalizeFlowConnections(conns){
  const seen = new Set();
  const valid = [];
  const ids = new Set(allFlowNodes().map(n => n.dataset.node));
  (conns || []).forEach(pair => {
    const from = Array.isArray(pair) ? pair[0] : pair.from;
    const to = Array.isArray(pair) ? pair[1] : pair.to;
    if(!from || !to || from === to || !ids.has(from) || !ids.has(to)) return;
    const key = `${from}->${to}`;
    if(seen.has(key)) return;
    seen.add(key);
    valid.push([from,to]);
  });
  return valid;
}

function ensureFlowCanvasSvg(){
  const viewport = getFlowViewport();
  if(!viewport) return null;
  let svg = $('flowCanvasSvg');
  if(!svg){
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'flowCanvasSvg';
    svg.classList.add('flow-canvas-svg');
    svg.setAttribute('aria-hidden','true');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `<marker id="flowCanvasArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#18e7ff"></path></marker>`;
    svg.appendChild(defs);
    viewport.prepend(svg);
  }
  return svg;
}

function nodeCenterInViewport(node){
  const vp = getFlowViewport();
  return {x: node.offsetLeft + node.offsetWidth/2, y: node.offsetTop + node.offsetHeight/2};
}

function redrawFlowCanvas(){
  const viewport = getFlowViewport();
  const svg = ensureFlowCanvasSvg();
  if(!viewport || !svg) return;
  svg.setAttribute('viewBox', `0 0 ${viewport.clientWidth} ${viewport.clientHeight}`);
  Array.from(svg.querySelectorAll('path.flow-canvas-line')).forEach(el => el.remove());
  flowConnections = normalizeFlowConnections(flowConnections);
  flowConnections.forEach(([from,to]) => {
    const a = getFlowNode(from); const b = getFlowNode(to);
    if(!a || !b || a.classList.contains('node-disabled') || b.classList.contains('node-disabled')) return;
    const p1 = nodeCenterInViewport(a); const p2 = nodeCenterInViewport(b);
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    const midY = (p1.y + p2.y)/2;
    let d;
    if(Math.abs(p1.y-p2.y) < 28){
      d = `M ${p1.x} ${p1.y} C ${(p1.x+p2.x)/2} ${p1.y}, ${(p1.x+p2.x)/2} ${p2.y}, ${p2.x} ${p2.y}`;
    }else{
      d = `M ${p1.x} ${p1.y} V ${midY} H ${p2.x} V ${p2.y}`;
    }
    path.setAttribute('d', d);
    path.setAttribute('marker-end', 'url(#flowCanvasArrow)');
    path.dataset.from = from; path.dataset.to = to;
    path.classList.add('flow-canvas-line');
    svg.appendChild(path);
  });
}

function setNodeExplicitPosition(node){
  if(!node || node.dataset.positionLocked === 'true') return;
  const left = node.offsetLeft;
  const top = node.offsetTop;
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
  node.dataset.positionLocked = 'true';
}

function makeNodeDraggable(node){
  if(!node || node.dataset.dragReady === 'true') return;
  node.dataset.dragReady = 'true';
  node.addEventListener('pointerdown', (e) => {
    if(e.button !== 0) return;
    if(e.target.closest('button,.node-enable-toggle')) return;
    if(connectMode) return;
    const viewport = getFlowViewport();
    setNodeExplicitPosition(node);
    node.setPointerCapture(e.pointerId);
    node.classList.add('dragging-node');
    const startX = e.clientX, startY = e.clientY;
    const startLeft = node.offsetLeft, startTop = node.offsetTop;
    const maxLeft = () => Math.max(0, viewport.clientWidth - node.offsetWidth - 6);
    const maxTop = () => Math.max(0, viewport.clientHeight - node.offsetHeight - 6);
    const move = (ev) => {
      const nextLeft = Math.min(maxLeft(), Math.max(0, startLeft + ev.clientX - startX));
      const nextTop = Math.min(maxTop(), Math.max(0, startTop + ev.clientY - startY));
      node.style.left = `${nextLeft}px`;
      node.style.top = `${nextTop}px`;
      redrawFlowCanvas();
    };
    const up = () => {
      node.classList.remove('dragging-node');
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
      persistFlowCanvas();
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    e.preventDefault();
    e.stopPropagation();
  });
  node.addEventListener('click', (e) => {
    if(e.target.closest('button,.node-enable-toggle')) return;
    if(!connectMode) return;
    const id = node.dataset.node;
    if(!connectSource){
      connectSource = id;
      node.classList.add('connect-source');
      setCanvasHint(`连线源节点：${getNodeMeta(id).name}，请选择目标Agent`);
    }else{
      const fromNode = getFlowNode(connectSource);
      fromNode?.classList.remove('connect-source');
      if(connectSource !== id){
        flowConnections.push([connectSource, id]);
        flowConnections = normalizeFlowConnections(flowConnections);
        redrawFlowCanvas();
        persistFlowCanvas();
        setCanvasHint(`已建立连线：${getNodeMeta(connectSource).name} → ${getNodeMeta(id).name}`);
      }
      connectSource = null;
    }
    e.preventDefault(); e.stopPropagation();
  });
}

function attachNodeEnableToggle(node){
  if(!node || node.querySelector('.node-enable-toggle')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'node-enable-toggle';
  btn.textContent = '启用';
  btn.title = '点击启用 / 停用这个Agent，执行当前画布时会自动跳过停用Agent';
  btn.addEventListener('click', (e) => {
    node.classList.toggle('node-disabled');
    btn.textContent = node.classList.contains('node-disabled') ? '停用' : '启用';
    redrawFlowCanvas();
    persistFlowCanvas();
    e.stopPropagation();
  });
  node.appendChild(btn);
}

function enhanceExistingFlowNodes(){
  allFlowNodes().forEach(node => {
    node.classList.remove('future-node');
    node.classList.add('revealed-node','flow-canvas-node');
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
  });
}

function buildFlowToolbar(){
  const panel = $('tree-panel');
  const head = panel?.querySelector('.panel-head');
  if(!panel || !head || panel.querySelector('.flow-builder-toolbar')) return;
  const toolbar = document.createElement('div');
  toolbar.className = 'flow-builder-toolbar';
  toolbar.dataset.noOverlay = 'true';
  toolbar.innerHTML = `
    <button type="button" data-flow-action="run-default">一键执行默认配置</button>
    <button type="button" data-flow-action="run-current">执行当前画布</button>
    <button type="button" data-flow-action="add-agent">添加Agent</button>
    <button type="button" data-flow-action="connect-mode">连线模式</button>
    <button type="button" data-flow-action="clear-lines">清空连线</button>
    <button type="button" data-flow-action="save-flow">保存画布</button>
    <button type="button" data-flow-action="reset-flow">恢复默认</button>
  `;
  head.appendChild(toolbar);

  const viewport = getFlowViewport();
  if(viewport && !viewport.querySelector('#flowAgentLibrary')){
    const lib = document.createElement('div');
    lib.id = 'flowAgentLibrary';
    lib.className = 'flow-agent-library';
    lib.dataset.noOverlay = 'true';
    lib.innerHTML = `<div class="flow-agent-library-head"><b>Agent组件库</b><button type="button" data-flow-action="close-agent-library">×</button></div><p>选择Agent后会加入画布，可拖动位置并手动连线。</p><div class="agent-lib-list"></div>`;
    const list = lib.querySelector('.agent-lib-list');
    AGENT_CATALOG.forEach(agent => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.addAgentId = agent.id;
      btn.innerHTML = `<span>${agent.icon}</span><b>${agent.name}</b><small>${agent.layer} · ${agent.role}</small>`;
      list.appendChild(btn);
    });
    viewport.appendChild(lib);
  }
  const hint = document.createElement('div');
  hint.id = 'flowCanvasHint';
  hint.className = 'flow-canvas-hint';
  hint.textContent = '工业级流程画布：Agent可拖动、可启停、可添加、可手动连线；一键执行可按当前拓扑逐层运行。';
  viewport?.appendChild(hint);
}

function setCanvasHint(text){
  const hint = $('flowCanvasHint');
  if(hint) hint.textContent = text;
}

function addAgentToCanvas(agentId){
  const viewport = getFlowViewport();
  const data = AGENT_CATALOG.find(a => a.id === agentId);
  if(!viewport || !data) return;
  let id = data.id;
  if(getFlowNode(id)){
    customAgentCounter += 1;
    id = `${data.id}_${customAgentCounter}`;
  }
  const node = document.createElement('article');
  node.id = `node-${id}`;
  node.className = 'tree-node agent custom-agent flow-canvas-node status-waiting revealed-node';
  node.dataset.node = id;
  node.style.left = `${Math.max(20, Math.min(viewport.clientWidth - 230, 60 + customAgentCounter * 36))}px`;
  node.style.top = `${Math.max(40, Math.min(viewport.clientHeight - 160, 110 + customAgentCounter * 22))}px`;
  node.dataset.positionLocked = 'true';
  node.innerHTML = `<em>${data.icon}</em><h3>${escapeHtml(data.name)}</h3><span class="badge">WAITING</span><p>输入摘要：${escapeHtml(data.input)}</p><p>证据：${escapeHtml(data.evidence)}</p><p>输出结论：${escapeHtml(data.output)}</p><strong>风险 ${escapeHtml(data.risk)}</strong><small>${Number(data.latency || 0)}ms</small><div class="node-work-summary">${escapeHtml(data.role)}</div>`;
  viewport.appendChild(node);
  FLOW_NODE_META[id] = {...data, id};
  attachNodeEnableToggle(node);
  makeNodeDraggable(node);
  // 默认把新Agent接在上下文建模与融合仲裁之间，用户可自行改线。
  if(getFlowNode('context_model')) flowConnections.push(['context_model', id]);
  if(getFlowNode('fusion_arbitration')) flowConnections.push([id, 'fusion_arbitration']);
  flowConnections = normalizeFlowConnections(flowConnections);
  redrawFlowCanvas();
  persistFlowCanvas();
  setCanvasHint(`已添加 ${data.name}，可拖动位置，也可开启连线模式重新定义依赖。`);
}

function resetDefaultFlowCanvas(){
  document.querySelectorAll('#treeViewport .custom-agent').forEach(n => n.remove());
  allFlowNodes().forEach(n => {
    n.classList.remove('node-disabled');
    const btn = n.querySelector('.node-enable-toggle');
    if(btn) btn.textContent = '启用';
    n.style.left = '';
    n.style.top = '';
    n.dataset.positionLocked = 'false';
  });
  flowConnections = DEFAULT_FLOW_CONNECTIONS.map(x => [...x]);
  localStorage.removeItem(FLOW_STORAGE_KEY);
  enhanceExistingFlowNodes();
  redrawFlowCanvas();
  setCanvasHint('已恢复默认多Agent协同流程：主干流程 → 六路并行审查 → 融合仲裁 → 控制任务 → 报告归档。');
}

function persistFlowCanvas(){
  const nodes = allFlowNodes().map(node => ({
    id: node.dataset.node,
    custom: node.classList.contains('custom-agent'),
    disabled: node.classList.contains('node-disabled'),
    left: node.style.left || '',
    top: node.style.top || '',
    html: node.classList.contains('custom-agent') ? node.innerHTML : null,
    className: node.className
  }));
  const payload = {nodes, connections: flowConnections, savedAt: new Date().toISOString()};
  localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(payload));
}

function loadFlowCanvas(){
  try{
    const raw = localStorage.getItem(FLOW_STORAGE_KEY);
    if(!raw){ flowConnections = DEFAULT_FLOW_CONNECTIONS.map(x => [...x]); return; }
    const payload = JSON.parse(raw);
    document.querySelectorAll('#treeViewport .custom-agent').forEach(n => n.remove());
    const viewport = getFlowViewport();
    (payload.nodes || []).forEach(record => {
      if(record.custom && record.id && record.html){
        const node = document.createElement('article');
        node.id = `node-${record.id}`;
        node.dataset.node = record.id;
        node.className = record.className || 'tree-node agent custom-agent flow-canvas-node status-waiting revealed-node';
        node.innerHTML = record.html;
        node.style.left = record.left || '60px';
        node.style.top = record.top || '130px';
        node.dataset.positionLocked = 'true';
        viewport?.appendChild(node);
      }else{
        const node = getFlowNode(record.id);
        if(node){
          if(record.left) node.style.left = record.left;
          if(record.top) node.style.top = record.top;
          if(record.left || record.top) node.dataset.positionLocked = 'true';
          node.classList.toggle('node-disabled', Boolean(record.disabled));
        }
      }
    });
    flowConnections = normalizeFlowConnections(payload.connections || DEFAULT_FLOW_CONNECTIONS);
  }catch(e){
    console.warn('流程画布加载失败，使用默认流程', e);
    flowConnections = DEFAULT_FLOW_CONNECTIONS.map(x => [...x]);
  }
}

function getEnabledNodeIds(){
  return allFlowNodes().filter(n => !n.classList.contains('node-disabled')).map(n => n.dataset.node);
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
  while(queue.length){
    const level = queue.filter(id => !seen.has(id));
    if(!level.length) break;
    levels.push(level);
    const next = [];
    level.forEach(id => {
      seen.add(id);
      (out.get(id) || []).forEach(to => {
        indeg.set(to, (indeg.get(to)||0)-1);
        if((indeg.get(to)||0) === 0) next.push(to);
      });
    });
    queue = next;
  }
  const missed = Array.from(ids).filter(id => !seen.has(id));
  if(missed.length) levels.push(missed);
  // 让默认流程顺序更符合展示语义。
  return levels.map(level => level.sort((a,b) => (nodeIds.indexOf(a) === -1 ? 99 : nodeIds.indexOf(a)) - (nodeIds.indexOf(b) === -1 ? 99 : nodeIds.indexOf(b))));
}

function canvasStatusFor(id, runningStatus=false){
  if(runningStatus) return 'RUNNING';
  const meta = getNodeMeta(id);
  if(id === 'fusion_arbitration') return 'LIMITED';
  if(id === 'control_task' || id === 'archive') return 'PASS';
  return meta.status || 'PASS';
}

function setCanvasNodeStatus(id, status){
  const node = getFlowNode(id);
  if(!node) return;
  node.classList.remove('future-node');
  setStatus(id, status);
  if(status === 'RUNNING') emitNodeParticles(id, 'parallel');
}

function buildCanvasAgentPanel(id, status){
  const meta = getNodeMeta(id);
  return {
    name: meta.name,
    status,
    risk: meta.risk || 'LOW',
    latency: `${meta.latency || 0}ms`,
    input: meta.input || '当前画布上游节点输出',
    rule: `${id.toUpperCase()}_FLOW_RULE`,
    evidence: meta.evidence || 'FLOW_CANVAS_EVIDENCE',
    suggestion: status === 'BLOCKED' ? '触发安全否决，建议重新规划或人工复核' : `根据当前画布依赖执行：${meta.output || '输出审理结论'}`,
    tool: `${meta.name} / FlowCanvas / PolicyMatrix`,
    work: [
      `读取上游画布节点输入：${meta.input || '上游输出'}`,
      `执行职责：${meta.role || '自定义Agent职责'}`,
      `形成输出：${meta.output || '写入多Agent决策上下文'}`
    ]
  };
}

function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

async function startCanvasDecision(useDefault=false){
  if(running) return;
  if(!isDeviceConnected()){
    showSystemNotice('暂无设备连接', '请先进入「系统配置 → 设备参数」，填写设备信息并连接成功后再启动多Agent决策。', '进入系统配置', () => openModuleOverlay('config', '系统配置中心'));
    appendLog('启动被拦截：未接入设备，流程画布只能配置，不能执行决策。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    updateRunGate();
    return;
  }
  if(useDefault) resetDefaultFlowCanvas();
  running = true;
  $('agentBus').textContent = 'RUNNING';
  const btn = $('startBtn');
  if(btn){ delete btn.dataset.completed; btn.innerHTML = '<span>●</span>流程画布执行中...'; }
  redrawFlowCanvas();
  allFlowNodes().forEach(n => {
    if(n.classList.contains('node-disabled')) return;
    setCanvasNodeStatus(n.dataset.node, 'WAITING');
    n.classList.remove('active');
  });
  const levels = computeFlowLevels();
  appendLog(`流程画布开始执行：${getEnabledNodeIds().length} 个Agent，${flowConnections.length} 条依赖连线。`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
  for(const level of levels){
    if(!running) break;
    level.forEach(id => {
      setCanvasNodeStatus(id, 'RUNNING');
      getFlowNode(id)?.classList.add('active');
      updateAgentPanel(buildCanvasAgentPanel(id, 'RUNNING'));
      $('focusLabel').textContent = level.length > 1 ? `并行决策：${level.length}个Agent` : getNodeMeta(id).name;
    });
    redrawFlowCanvas();
    const names = level.map(id => getNodeMeta(id).name).join('、');
    appendLog(`${level.length > 1 ? '并行审查' : '单节点审查'}：${names} 正在决策。`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    await sleep(2100 + Math.min(level.length, 6) * 320);
    level.forEach(id => {
      const finalStatus = canvasStatusFor(id, false);
      setCanvasNodeStatus(id, finalStatus);
      getFlowNode(id)?.classList.remove('active');
      updateAgentPanel(buildCanvasAgentPanel(id, finalStatus));
      appendLog(`[${getNodeMeta(id).name}] 输出：${getNodeMeta(id).output || finalStatus} / 状态 ${finalStatus}`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    });
    await sleep(520);
  }
  updateTask({task_id:'TASK_FLOW_CANVAS_021', type:'PICK_AND_PLACE', safety_mode:'LIMITED'});
  $('focusLabel').textContent = '流程画布执行完成';
  $('agentBus').textContent = 'DONE';
  if(btn){ btn.dataset.completed = 'true'; btn.innerHTML = '<span>✓</span>决策完成，可重新启动'; }
  running = false;
}

// 覆盖默认启动行为，按当前可编辑工作流执行。
function startDecision(){
  return startCanvasDecision(false);
}

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
  enhanceExistingFlowNodes();
  redrawFlowCanvas();
  setCanvasHint('流程画布已启用：拖动Agent调整位置，点击“添加Agent”扩展能力，开启“连线模式”后按源→目标建立依赖。');
  window.addEventListener('resize', redrawFlowCanvas);
  document.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-flow-action]');
    if(!actionEl) return;
    const action = actionEl.dataset.flowAction;
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
      redrawFlowCanvas(); persistFlowCanvas();
      setCanvasHint('已清空所有连线，可用连线模式重新组织决策流程。');
    }
    if(action === 'save-flow'){
      persistFlowCanvas();
      showSystemNotice('流程画布已保存', '当前Agent位置、启停状态和连线关系已保存到本地浏览器。', '知道了');
    }
    if(action === 'reset-flow') resetDefaultFlowCanvas();
    e.preventDefault(); e.stopPropagation();
  }, true);
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add-agent-id]');
    if(!add) return;
    addAgentToCanvas(add.dataset.addAgentId);
    e.preventDefault(); e.stopPropagation();
  }, true);
}

document.addEventListener('DOMContentLoaded', () => {
  initFlowCanvasBuilder();
  // 让工业级流程画布首屏呈现“可配置画布”，不是固定死的流程图。
  setTimeout(() => {
    enhanceExistingFlowNodes();
    redrawFlowCanvas();
  }, 120);
});



