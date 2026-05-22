const MODEL_RUNTIME_DEVICE_STORAGE_KEY = 'zltx_device_config_primary';
const MODEL_RUNTIME_FLOW_STORAGE_KEY = 'zltx_agent_workflow_canvas_empty_manual';
const MODEL_RUNTIME_FLOW_MODE_KEY = 'zltx_agent_workflow_mode';
const AGENT_MODEL_STORAGE_KEY = 'zltx_agent_model_registry';
const MODEL_RUNTIME_CANVAS_SIZE = { width: 2320, height: 1180 };
const MODEL_RUNTIME_DEFAULT_POSITIONS = {
  state_capture:       {left: 110,  top: 105, width: 390},
  context_model:       {left: 930,  top: 105, width: 520},
  vision_quality:      {left: 70,   top: 365, width: 330},
  localization_3d:     {left: 455,  top: 365, width: 330},
  placement_plan:      {left: 840,  top: 365, width: 330},
  hardware_interlock:  {left: 1225, top: 365, width: 330},
  safety_strategy:     {left: 1610, top: 365, width: 330},
  execution_constraint:{left: 1995, top: 365, width: 330},
  fusion_arbitration:  {left: 860,  top: 720, width: 470},
  control_task:        {left: 1455, top: 760, width: 390},
  archive:             {left: 1915, top: 760, width: 330}
};

Object.assign(moduleTitleMap, {
  'model-import': 'Agent模型导入 / 来源登记'
});
if(typeof MODULE_DETAIL_META !== 'undefined'){
  MODULE_DETAIL_META['model-import'] = {
    title:'Agent模型导入 / 来源登记',
    tag:'AGENT MODEL REGISTRY',
    desc:'登记Agent模型来源、版本、能力标签和注册状态，让评委知道每个Agent从哪里来、如何进入组件库和决策画布。',
    bullets:['支持本地模型文件、配置文件和基线模型登记','导入后可注册到Agent组件库','每个Agent显示来源、版本、能力和状态','用于记录Agent能力来自模型仓库、规则模板和工具链注册']
  };
}

function getStoredDevice(){
  try{
    const raw = localStorage.getItem(MODEL_RUNTIME_DEVICE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ console.warn('设备参数读取失败', e); return null; }
}
function saveStoredDevice(data){
  const payload = {...data, deviceId:'001', connected:true, connectedAt:new Date().toISOString()};
  localStorage.setItem(MODEL_RUNTIME_DEVICE_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}
function clearStoredDevice(){ localStorage.removeItem(MODEL_RUNTIME_DEVICE_STORAGE_KEY); }
function isDeviceConnected(){
  const device = getStoredDevice();
  return Boolean(device && device.connected);
}

function getImportedAgentModels(){
  try{
    const raw = localStorage.getItem(AGENT_MODEL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ console.warn('Agent模型库读取失败', e); return []; }
}
function saveImportedAgentModels(list){
  localStorage.setItem(AGENT_MODEL_STORAGE_KEY, JSON.stringify(list || []));
}
function inferModelType(filename){
  const ext = String(filename || '').split('.').pop().toLowerCase();
  if(['onnx','pt','pth','bin','safetensors'].includes(ext)) return '模型权重';
  if(['json','yaml','yml'].includes(ext)) return 'Agent配置';
  if(['py','js','ts'].includes(ext)) return 'Agent代码';
  if(['zip','tar','gz'].includes(ext)) return 'Agent工程包';
  return '自定义模型';
}
function agentModelToCatalog(model){
  return {
    id: model.id,
    name: model.agentName || model.name || '导入Agent',
    layer: model.layer || '导入层',
    role: `来源：${model.source || '本地导入'}；版本：${model.version || 'V3.2'}；能力：${(model.skills || []).join('、') || '自定义决策'}`,
    icon: model.icon || '⬡',
    risk: model.risk || 'LOW',
    latency: Number(model.latency || 86),
    status: model.status || 'PASS',
    input: model.input || '导入模型输入载荷',
    evidence: model.evidence || `MODEL_SOURCE_${String(model.source || 'LOCAL').toUpperCase().replace(/\W+/g,'_')}`,
    output: model.output || '导入Agent输出结论',
    modelSource: model.source || '本地导入',
    modelVersion: model.version || 'V3.2'
  };
}
function syncImportedAgentsToCatalog(){
  const list = getImportedAgentModels();
  list.forEach(model => {
    if(!model.id) return;
    if(!AGENT_CATALOG.some(a => a.id === model.id)){
      AGENT_CATALOG.push(agentModelToCatalog(model));
    }
  });
}
function refreshAgentLibraryButtons(){
  const lib = $('flowAgentLibrary');
  if(!lib) return;
  let importedSection = lib.querySelector('[data-lib="imported-models"]');
  if(!importedSection){
    const section = document.createElement('div');
    section.className = 'agent-lib-section imported-model-section';
    section.innerHTML = '<h4>已导入Agent模型</h4><div class="agent-lib-list" data-lib="imported-models"></div>';
    lib.appendChild(section);
    importedSection = section.querySelector('[data-lib="imported-models"]');
  }
  importedSection.innerHTML = '';
  const models = getImportedAgentModels();
  if(!models.length){
    importedSection.innerHTML = '<p class="empty-model-library">暂无导入模型，请从左侧“模型导入”登记。</p>';
    return;
  }
  models.forEach(model => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.addAgentId = model.id;
    btn.innerHTML = `<span>${escapeHtml(model.icon || '⬡')}</span><b>${escapeHtml(model.agentName || model.name)}</b><small>${escapeHtml(model.source || '本地导入')} · ${escapeHtml(model.version || 'V3.2')} · ${(model.skills || []).map(escapeHtml).join(' / ')}</small>`;
    importedSection.appendChild(btn);
  });
}
function registerSampleAgentModels(){
  const samples = [
    {id:'imported_governance_spec_agent', name:'工业规范治理规范Agent.json', agentName:'工业规范治理规范审查Agent', source:'工业规范治理技能库', version:'V3.2', layer:'规范层', icon:'▧', skills:['spec校验','变更审计','任务追踪'], input:'proposal/design/tasks/specs', evidence:'GOVERNANCE_PROFILE_CUSTOM', output:'规范一致性审查结论', risk:'LOW', latency:78},
    {id:'imported_promptwizard_optimizer', name:'prompt_optimizer_agent.py', agentName:'提示词优化Agent', source:'提示词优化组件库', version:'V3.2', layer:'优化层', icon:'✦', skills:['Prompt优化','候选评估','规则生成'], input:'Agent提示词与决策说明', evidence:'PROMPT_OPT_CHAIN', output:'提示词改写建议', risk:'LOW', latency:104},
    {id:'imported_crewai_executor', name:'crewai_executor.yaml', agentName:'协同执行Agent', source:'协同执行模板', version:'V3.2', layer:'协同层', icon:'⌘', skills:['任务分派','角色协作','工具调度'], input:'多Agent任务上下文', evidence:'CREW_ROLE_SCHEMA', output:'协同执行计划', risk:'MEDIUM', latency:136},
    {id:'imported_safety_policy_model', name:'safety_policy_matrix.json', agentName:'安全策略模型Agent', source:'本地安全策略文件', version:'V3.2', layer:'安全层', icon:'◈', skills:['安全否决','权限矩阵','风险合成'], input:'设备状态/权限模板/风险字段', evidence:'SAFETY_POLICY', output:'动作权限判定', risk:'MEDIUM', latency:92}
  ];
  const existing = getImportedAgentModels();
  const byId = new Map(existing.map(x => [x.id, x]));
  samples.forEach(s => byId.set(s.id, {...s, importedAt: new Date().toISOString(), registered:true}));
  saveImportedAgentModels(Array.from(byId.values()));
  syncImportedAgentsToCatalog();
  refreshAgentLibraryButtons();
}
function removeImportedAgentModel(id){
  const next = getImportedAgentModels().filter(m => m.id !== id);
  saveImportedAgentModels(next);
  const node = getFlowNode(id);
  if(node?.classList.contains('custom-agent')) removeCustomAgentFromCanvas(id);
  refreshAgentLibraryButtons();
  return next;
}

function buildRuntimeDocsPanel(){
  return `
    <section class="runtime-docs-panel" id="runtimeDocsPanel">
      <div class="runtime-docs-main">
        <span>TEST DOCUMENTS</span>
        <h4>运行生成的测试文档与接口文档</h4>
        <p>平台启动后检查接口文档、测试文档和测试用例；已有文件不再重复覆盖，避免每次运行生成重复文档。</p>
        <div class="runtime-docs-paths">
          <b>docs/接口文档.md</b>
          <b>docs/测试文档.md</b>
          <b>docs/测试用例.csv</b>
        </div>
      </div>
      <div class="runtime-docs-grid">
        <p><span>API 地址</span><strong id="docApiAddress">读取中...</strong></p>
        <p><span>API 密钥</span><strong id="docApiKey">读取中...</strong></p>
        <p><span>Agent 能力说明</span><strong id="docAgentAbility">视觉、定位、规划、联锁、安全、执行约束、融合仲裁</strong></p>
        <p><span>Trace 日志</span><strong id="docTraceLog">等待读取运行生成信息</strong></p>
      </div>
      <button data-action="refresh-runtime-docs">刷新文档状态</button>
    </section>`;
}

async function refreshRuntimeDocsPanel(){
  try{
    const res = await fetch('/api/test/generated-docs');
    const data = await res.json();
    const api = document.getElementById('docApiAddress');
    const key = document.getElementById('docApiKey');
    const ability = document.getElementById('docAgentAbility');
    const trace = document.getElementById('docTraceLog');
    if(api) api.textContent = data.api_address || 'http://127.0.0.1:7860';
    if(key) key.textContent = data.api_key || 'zltx_live_sk_runtime_key_pending';
    if(ability) ability.textContent = (data.agent_abilities || []).slice(0, 2).join('；') || '多Agent决策能力已登记';
    if(trace) trace.textContent = (data.trace_logs || [])[0] || 'Trace日志已随运行文档生成';
  }catch(e){
    const trace = document.getElementById('docTraceLog');
    if(trace) trace.textContent = '文档状态读取失败，请确认后端服务已启动';
  }
}

function buildAgentModelImportView(){
  const models = getImportedAgentModels();
  const rows = models.length ? models.map((m, idx) => `<article class="model-registry-card">
    <div class="model-no">${String(idx+1).padStart(2,'0')}</div>
    <div class="model-main"><h4>${escapeHtml(m.agentName || m.name)}</h4><p>${escapeHtml(m.name || '-')}</p><div><span>来源：${escapeHtml(m.source || '本地导入')}</span><span>类型：${escapeHtml(m.type || 'Agent模型')}</span><span>版本：${escapeHtml(m.version || 'V3.2')}</span></div><small>能力：${(m.skills || []).map(escapeHtml).join('、') || '自定义决策'} · 状态：已注册到组件库</small></div>
    <button data-action="remove-imported-agent" data-model-id="${escapeHtml(m.id)}">删除</button>
  </article>`).join('') : '<div class="empty-import-state"><b>暂无Agent模型</b><p>请上传模型/配置/代码文件，或导入基线模型，完成Agent能力来源登记。</p></div>';
  const wrap = document.createElement('div');
  wrap.className = 'model-import-view';
  wrap.innerHTML = `
    <section class="model-import-hero"><div><span>AGENT MODEL REGISTRY</span><h3>Agent模型导入中心</h3><p>用于登记Agent从哪里来：本地模型文件、工业规范治理规范技能、提示词优化链路、协同执行模板或自定义工程包。导入后会出现在组件库中，可拖入画布参与决策。</p></div><b>${models.length} 个模型已注册</b></section>
    <section class="model-import-layout">
      <article class="model-import-form">
        <h4>导入Agent模型</h4>
        <label>Agent显示名称<input id="agentModelNameInput" placeholder="例如：视觉质量复核Agent" /></label>
        <label>模型来源<select id="agentModelSourceInput"><option>本地导入</option><option>工业规范治理技能库</option><option>提示词优化组件库</option><option>协同执行模板</option><option>工程仓库</option><option>算法工程师模型</option></select></label>
        <label>层级/类型<select id="agentModelLayerInput"><option>专家层</option><option>安全层</option><option>仲裁层</option><option>接入层</option><option>优化层</option><option>规范层</option></select></label>
        <label>能力标签<input id="agentModelSkillsInput" placeholder="例如：质量复核,风险复核,证据生成" /></label>
        <label>版本号<input id="agentModelVersionInput" value="V3.2" /></label>
        <label class="model-file-picker">模型/配置文件<input id="agentModelFileInput" type="file" multiple accept=".json,.yaml,.yml,.py,.zip,.onnx,.pt,.pth,.safetensors,.txt" /></label>
        <div class="model-import-actions"><button data-action="import-agent-models">确认导入并注册</button><button data-action="import-sample-agent-models">导入示例Agent模型</button><button data-action="clear-agent-models">清空模型库</button></div>
      </article>
      <article class="model-origin-flow"><h4>Agent来源链路</h4><div class="origin-flow-line"><span>模型文件</span><i></i><span>能力解析</span><i></i><span>注册组件库</span><i></i><span>拖入画布</span><i></i><span>参与决策</span></div><p>导入的Agent会记录来源、版本、能力标签和注册状态。后续在画布组件库中选择它，就能说明“这个Agent从哪里来、为什么能执行这个职责”。</p></article>
      <article class="model-registry-list"><h4>已导入Agent模型</h4>${rows}</article>
    </section>`;
  setTimeout(refreshRuntimeDocsPanel, 80);
  return wrap;
}
function importAgentModelsFromForm(){
  const fileInput = $('agentModelFileInput');
  const files = Array.from(fileInput?.files || []);
  const displayName = $('agentModelNameInput')?.value.trim();
  const source = $('agentModelSourceInput')?.value || '本地导入';
  const layer = $('agentModelLayerInput')?.value || '专家层';
  const version = $('agentModelVersionInput')?.value.trim() || 'V3.2';
  const skills = ($('agentModelSkillsInput')?.value || '').split(/[,，\s]+/).filter(Boolean);
  if(!files.length && !displayName){
    showSystemNotice('未选择模型', '请至少填写Agent名称，或选择一个模型/配置/代码文件。', '知道了');
    return;
  }
  const list = getImportedAgentModels();
  const targets = files.length ? files : [{name: displayName || 'manual-agent.json'}];
  targets.forEach((f, i) => {
    const baseName = displayName || String(f.name || '导入Agent').replace(/\.[^.]+$/, '');
    const id = 'imported_' + baseName.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_').slice(0, 36) + '_' + Date.now().toString(36) + '_' + i;
    list.push({id, name:f.name || baseName, agentName:baseName, source, version, layer, type:inferModelType(f.name), icon:'⬡', skills: skills.length ? skills : ['模型推理','规则审查','证据输出'], input:'模型输入载荷 / 工业状态字段', evidence:'IMPORTED_MODEL_REGISTERED', output:'Agent决策结论', risk:'LOW', latency:90, importedAt:new Date().toISOString(), registered:true});
  });
  saveImportedAgentModels(list);
  syncImportedAgentsToCatalog();
  refreshAgentLibraryButtons();
  openModuleOverlay('model-import', 'Agent模型导入 / 来源登记');
  showSystemNotice('导入成功', 'Agent模型已注册到组件库，可在“添加Agent/仲裁组件”中拖入画布。', '知道了');
}

function applyPlatformVersionLabelsFromModelRuntime(){
  document.title = '智领铜行--人工智能机械臂多Agent智能决策平台 V3.2';
  document.querySelectorAll('.brand-ver').forEach(el => el.textContent = 'V3.2');
  const version = document.querySelector('.platform-card .pc-row:last-child strong');
  if(version) version.textContent = 'V3.2';
}

function applyDefaultWorkflowNodePosition(id){
  const node = getFlowNode?.(id);
  const pos = MODEL_RUNTIME_DEFAULT_POSITIONS[id] || MODEL_RUNTIME_DEFAULT_POSITIONS[id];
  if(!node || !pos) return;
  node.style.left = `${pos.left}px`;
  node.style.top = `${pos.top}px`;
  node.style.width = `${pos.width}px`;
  node.style.height = 'auto';
  node.style.maxHeight = 'none';
  node.dataset.positionLocked = 'true';
}

function makeNodeDraggable(node){
  if(!node) return;
  if(node.dataset.dragReady === 'true') return;
  node.dataset.dragReady = 'true';
  node.addEventListener('pointerdown', (e) => {
    if(e.button !== 0) return;
    if(e.target.closest('button,.node-enable-toggle,.node-delete-btn')) return;
    if(connectMode) return;
    const viewport = getFlowViewport();
    if(!viewport) return;
    setNodeExplicitPosition(node);
    node.setPointerCapture(e.pointerId);
    node.classList.add('dragging-node');
    const startX = e.clientX, startY = e.clientY;
    const startLeft = node.offsetLeft, startTop = node.offsetTop;
    const maxLeft = () => Math.max(0, Math.max(viewport.scrollWidth, MODEL_RUNTIME_CANVAS_SIZE.width) - node.offsetWidth - 18);
    const maxTop = () => Math.max(0, Math.max(viewport.scrollHeight, MODEL_RUNTIME_CANVAS_SIZE.height) - node.offsetHeight - 18);
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
    if(e.target.closest('button,.node-enable-toggle,.node-delete-btn')) return;
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

function redrawFlowCanvas(){
  const viewport = getFlowViewport();
  const svg = ensureFlowCanvasSvg();
  if(!viewport || !svg) return;
  ensureWorkflowCanvasTag?.();
  let maxX = MODEL_RUNTIME_CANVAS_SIZE.width;
  let maxY = MODEL_RUNTIME_CANVAS_SIZE.height;
  visibleFlowNodes().forEach(node => {
    maxX = Math.max(maxX, node.offsetLeft + node.offsetWidth + 140);
    maxY = Math.max(maxY, node.offsetTop + node.offsetHeight + 150);
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
  localStorage.setItem(MODEL_RUNTIME_FLOW_STORAGE_KEY, JSON.stringify(payload));
}

function loadFlowCanvas(){
  try{
    syncImportedAgentsToCatalog();
    const raw = localStorage.getItem(MODEL_RUNTIME_FLOW_STORAGE_KEY);
    document.querySelectorAll('#treeViewport .custom-agent').forEach(n => n.remove());
    hideDefaultNodesForManualCanvas();
    flowConnections = [];
    if(!raw){ setEmptyManualCanvas(false); return; }
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
        node.style.left = record.left || '80px';
        node.style.top = record.top || '90px';
        node.style.width = record.width || node.style.width || '330px';
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
    console.warn('V3.2流程画布加载失败，使用空白手动画布', e);
    setEmptyManualCanvas(true);
  }
}

try { flowCanvasMode = localStorage.getItem(MODEL_RUNTIME_FLOW_MODE_KEY) || 'manual'; } catch(e) { flowCanvasMode = 'manual'; }
function setCanvasMode(mode){
  flowCanvasMode = mode === 'auto' ? 'auto' : 'manual';
  localStorage.setItem(MODEL_RUNTIME_FLOW_MODE_KEY, flowCanvasMode);
  document.querySelectorAll('[data-flow-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.flowMode === flowCanvasMode));
  if(flowCanvasMode === 'manual') setCanvasHint('当前为手动添加模式：画布默认空白。可先进入“模型导入”登记Agent来源，再从组件库拖入画布。');
  else setCanvasHint('当前为Agent自动决策模式：点击“一键执行默认配置”后，系统逐步生成默认多Agent流程。');
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
      <span class="workflow-mode-help">默认手动，初始画布为空</span>
    </div>
    <div class="workflow-action-group">
      <button type="button" class="model-import-btn" data-flow-action="open-model-import">导入Agent模型</button>
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
  if(viewport && !document.getElementById('flowAgentLibrary')){
    const lib = document.createElement('div');
    lib.id = 'flowAgentLibrary';
    lib.className = 'flow-agent-library agent-component-library workflow-agent-library workflow-agent-library workflow-agent-library';
    lib.dataset.noOverlay = 'true';
    lib.innerHTML = `<div class="flow-agent-library-head"><b>Agent与仲裁组件库</b><button type="button" data-flow-action="toggle-library-size" title="折叠/展开">—</button><button type="button" data-flow-action="close-agent-library">×</button></div><p>组件库为侧边抽屉，不占用画布空间。导入的Agent模型也会显示在这里。</p><div class="agent-lib-section"><h4>专业Agent</h4><div class="agent-lib-list" data-lib="agent"></div></div><div class="agent-lib-section"><h4>仲裁Agent / 仲裁组件</h4><div class="agent-lib-list" data-lib="arbitration"></div></div>`;
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
    document.body.appendChild(lib);
  }
  if(viewport && !viewport.querySelector('#flowCanvasHint')){
    const hint = document.createElement('div');
    hint.id = 'flowCanvasHint';
    hint.className = 'flow-canvas-hint';
    viewport.appendChild(hint);
  }
  applyArbitrationMode();
  setCanvasMode(flowCanvasMode);
  refreshAgentLibraryButtons?.();
}

function openModuleOverlay(targetId, title){
  const overlay = $('moduleOverlay');
  const content = $('overlayContent');
  const overlayTitle = $('overlayTitle');
  if(!overlay || !content || !overlayTitle) return;
  overlayTitle.textContent = title || moduleTitleMap[targetId] || targetId;
  content.innerHTML = '';
  if(targetId === 'model-import') {
    content.appendChild(buildAgentModelImportView());
  } else if(targetId === 'config') {
    content.appendChild(buildConfigCenterView());
  } else if(targetId === 'device-config') {
    content.appendChild(buildDeviceConfigView());
    bindDeviceConfigView(content);
  } else if(targetId === 'agent-role-map') {
    overlayTitle.textContent = 'Agent分工与作用图谱';
    content.appendChild(buildAgentRoleMapView());
  } else if(targetId === 'workbench') {
    const dash = document.createElement('div');
    dash.className = 'workbench-focus-view';
    dash.innerHTML = `<section class="module-detail-hero"><div><span>WORKBENCH OVERVIEW</span><h3>决策工作台总览</h3><p>首页每个板块都可以点击放大查看，决策树、审理台、状态帧、模型输出、模型导入、证据链、权限矩阵、Trace、归档都已接入模块详情。</p></div><button class="detail-action-btn" data-action="show-agent-role-map">查看Agent分工</button></section><section class="workbench-module-map"></section>`;
    const grid = dash.querySelector('.workbench-module-map');
    ['tree-panel','agent-review','state-snapshot','model-output','model-import','evidence','matrix','control-task','trace','archive','alarm'].forEach(id => {
      const meta = MODULE_DETAIL_META[id];
      const item = document.createElement('button');
      item.className = 'workbench-module-card';
      item.dataset.moduleTarget = id;
      item.innerHTML = `<span>${escapeHtml(meta?.tag || 'MODULE')}</span><b>${escapeHtml(meta?.title || moduleTitleMap[id])}</b><p>${escapeHtml(meta?.desc || '')}</p>`;
      grid.appendChild(item);
    });
    content.appendChild(dash);
  } else {
    content.appendChild(buildModuleDetailView(targetId));
  }
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');
}

function initModelImportNav(){
  if(document.querySelector('.nav-item[href="#model-import"]')) return;
  const target = document.querySelector('.nav-item[href="#model-output"]');
  if(target){
    const a = document.createElement('a');
    a.className = 'nav-item';
    a.href = '#model-import';
    a.innerHTML = '<span>⇪</span><b>模型导入</b>';
    target.insertAdjacentElement('afterend', a);
  }
}

document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if(action === 'import-agent-models'){
    e.preventDefault(); e.stopPropagation();
    importAgentModelsFromForm();
  }
  if(action === 'import-sample-agent-models'){
    e.preventDefault(); e.stopPropagation();
    registerSampleAgentModels();
    openModuleOverlay('model-import', 'Agent模型导入 / 来源登记');
    showSystemNotice('基线模型已导入', '已注册工业规范治理、提示词优化组件、协同执行组件和安全策略模型Agent，可从组件库加入画布。', '知道了');
  }
  if(action === 'refresh-runtime-docs'){
    e.preventDefault(); e.stopPropagation();
    refreshRuntimeDocsPanel();
  }
  if(action === 'clear-agent-models'){
    e.preventDefault(); e.stopPropagation();
    saveImportedAgentModels([]);
    refreshAgentLibraryButtons();
    openModuleOverlay('model-import', 'Agent模型导入 / 来源登记');
  }
  if(action === 'remove-imported-agent'){
    e.preventDefault(); e.stopPropagation();
    removeImportedAgentModel(e.target.closest('[data-model-id]')?.dataset.modelId);
    openModuleOverlay('model-import', 'Agent模型导入 / 来源登记');
  }
  if(e.target.closest('[data-flow-action="open-model-import"]')){
    e.preventDefault(); e.stopPropagation();
    openModuleOverlay('model-import', 'Agent模型导入 / 来源登记');
  }
}, true);

function updateModelImportBadges(){
  const item = document.querySelector('.nav-item[href="#model-import"] b');
  if(item){
    const count = getImportedAgentModels().length;
    item.textContent = count ? `模型导入 (${count})` : '模型导入';
  }
  const mapBtn = document.querySelector('.agent-map-trigger');
  if(mapBtn) mapBtn.innerHTML = `参与Agent：<b>可自定义</b> · 模型库 <b>${getImportedAgentModels().length}</b> 个 · 查看作用`;
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initModelImportNav();
    applyPlatformVersionLabelsFromModelRuntime();
    syncImportedAgentsToCatalog();
    refreshAgentLibraryButtons();
    updateModelImportBadges();
    const vp = getFlowViewport?.();
    if(vp){
      vp.classList.add('model-runtime-canvas-contained');
      vp.style.setProperty('--workflow-canvas-w', `${MODEL_RUNTIME_CANVAS_SIZE.width}px`);
      vp.style.setProperty('--workflow-canvas-h', `${MODEL_RUNTIME_CANVAS_SIZE.height}px`);
    }
    redrawFlowCanvas();
    updateRunGate?.();
  }, 700);
});


