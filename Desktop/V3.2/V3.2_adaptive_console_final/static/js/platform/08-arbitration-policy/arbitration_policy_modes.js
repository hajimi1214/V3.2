const FLOW_ARBITRATION_MODE_KEY = 'zltx_arbitration_mode';
const ARBITRATION_MODES = {
  safety_veto: {
    label: '安全否决优先',
    risk: 'MEDIUM',
    status: 'LIMITED',
    rule: 'SAFETY_VETO_FIRST',
    evidence: 'BLOCKED节点触发否决复核，LIMITED节点进入降级策略',
    output: 'PICK_AND_PLACE_LIMITED',
    desc: '任何高危安全项优先触发否决或降级，其余Agent通过权重投票修正动作。'
  },
  weighted_vote: {
    label: '加权投票仲裁',
    risk: 'LOW',
    status: 'PASS',
    rule: 'WEIGHTED_VOTE_70',
    evidence: '安全策略0.35 / 硬件联锁0.25 / 执行约束0.20 / 视觉定位0.20',
    output: 'PICK_AND_PLACE_LIMITED',
    desc: '按Agent权重合成结论，超过共识阈值后生成动作建议。'
  },
  consensus: {
    label: '共识仲裁',
    risk: 'LOW',
    status: 'PASS',
    rule: 'CONSENSUS_THRESHOLD_80',
    evidence: '至少80%专家Agent同意才允许动作继续',
    output: 'READY_TO_DISPATCH',
    desc: '强调多Agent一致性，适合低风险标准动作。'
  },
  manual_review: {
    label: '人工复核仲裁',
    risk: 'MEDIUM',
    status: 'LIMITED',
    rule: 'HUMAN_REVIEW_REQUIRED',
    evidence: '存在冲突结论或高风险执行约束，转人工复核队列',
    output: 'WAIT_OPERATOR_CONFIRM',
    desc: '当Agent结论冲突或风险等级偏高时，不直接放行，生成待人工确认任务。'
  },
  minimum_risk: {
    label: '最小风险仲裁',
    risk: 'LOW',
    status: 'PASS',
    rule: 'MIN_RISK_ACTION_SELECT',
    evidence: '选择风险最小的动作组合，优先RECHECK/限速/降级执行',
    output: 'PICK_AND_PLACE_LIMITED',
    desc: '在多个可行动作中选择风险最低的控制策略。'
  }
};

try {
  Object.assign(FLOW_NODE_META.fusion_arbitration, {name:'融合仲裁 / 最终仲裁Agent', layer:'仲裁层', role:'单独的仲裁节点，可选择安全否决、加权投票、共识仲裁、人工复核、最小风险等模式'});
  Object.assign(FLOW_NODE_META.control_task, {name:'控制任务生成模块', layer:'控制模块', role:'接收仲裁结论，生成控制任务JSON、轨迹序列和执行许可清单', icon:'⚙', status:'PASS', output:'控制任务JSON已生成'});
  Object.assign(FLOW_NODE_META.archive, {name:'报告归档模块', layer:'归档模块', role:'非Agent模块：固化Trace、证据链、设备参数和PDF打印模板', icon:'▤', status:'PASS', output:'报告已归档'});
  nodeName.control_task = '控制任务生成模块';
  nodeName.archive = '报告归档模块';
  if (AGENT_ROLE_DETAILS[10]) {
    AGENT_ROLE_DETAILS[10].name = '控制任务生成模块';
    AGENT_ROLE_DETAILS[10].layer = '控制模块';
    AGENT_ROLE_DETAILS[10].role = '将仲裁结论转换为控制任务JSON、轨迹序列和下发前安全参数';
    AGENT_ROLE_DETAILS[10].work = '读取最终仲裁动作、权限矩阵和设备参数，生成MOVEJ/MOVEL/PICK等控制序列';
  }
  if (AGENT_ROLE_DETAILS[11]) {
    AGENT_ROLE_DETAILS[11].name = '报告归档模块';
    AGENT_ROLE_DETAILS[11].layer = '归档模块';
    AGENT_ROLE_DETAILS[11].role = '固化决策Trace、证据链、设备参数和审计报告';
    AGENT_ROLE_DETAILS[11].work = '汇总多Agent决策过程、最终动作、风险等级和设备编号，生成归档记录';
  }
  AGENT_DECISION_SUPPORT['控制任务生成模块'] = AGENT_DECISION_SUPPORT['控制任务生成Agent'];
  AGENT_DECISION_SUPPORT['报告归档模块'] = AGENT_DECISION_SUPPORT['报告归档Agent'];
} catch(e) { console.warn('V3.2元数据更新失败', e); }

AGENT_CATALOG.push(
  {id:'risk_quantify', name:'风险量化Agent', layer:'安全层', role:'把视觉、联锁、执行约束转成统一风险分值', icon:'◇', risk:'MEDIUM', latency:84, status:'PASS', input:'多源风险字段', evidence:'RISK_SCORE_0.31', output:'风险分值已生成'},
  {id:'tool_calibrator', name:'工具标定Agent', layer:'设备层', role:'检查TCP工具坐标、夹具偏移和标定版本', icon:'⌖', risk:'LOW', latency:51, status:'PASS', input:'TCP/夹具/标定文件', evidence:'CALIB_VER_A03', output:'工具标定有效'},
  {id:'trajectory_ranker', name:'轨迹排序Agent', layer:'规划层', role:'对多条候选路径按节拍、风险、能耗排序', icon:'⇅', risk:'LOW', latency:89, status:'PASS', input:'候选轨迹集合', evidence:'RANK_TOP3', output:'选择最优候选轨迹'},
  {id:'quality_after_pick', name:'抓取后质检Agent', layer:'质检层', role:'抓取后复核目标是否离位、夹持是否稳定', icon:'◒', risk:'LOW', latency:96, status:'PASS', input:'抓取后相机ROI/夹具压力', evidence:'POST_PICK_PASS', output:'抓取后质检通过'},
  {id:'maintenance_predict', name:'维护预测Agent', layer:'运维层', role:'根据电机温度、振动和运行时长预测设备维护风险', icon:'▥', risk:'LOW', latency:73, status:'PASS', input:'电机温度/振动/运行时长', evidence:'MAINT_SCORE_0.18', output:'无需维护干预'},
  {id:'dispatch_sync', name:'产线调度同步Agent', layer:'调度层', role:'同步AGV、PLC和产线节拍，避免任务冲突', icon:'⇄', risk:'LOW', latency:61, status:'PASS', input:'AGV ETA/PLC队列/任务池', evidence:'SLOT_AVAILABLE', output:'调度窗口可用'},
  {id:'veto_arbitration', name:'安全否决仲裁Agent', layer:'仲裁层', role:'独立仲裁组件：安全项优先，发现高危直接降级或阻断', icon:'⚖', risk:'MEDIUM', latency:132, status:'LIMITED', input:'专家Agent结论集合', evidence:'SAFETY_VETO_FIRST', output:'安全否决仲裁结论'},
  {id:'vote_arbitration', name:'加权投票仲裁Agent', layer:'仲裁层', role:'独立仲裁组件：按权重融合多个Agent输出', icon:'☷', risk:'LOW', latency:118, status:'PASS', input:'专家Agent结论和权重', evidence:'WEIGHTED_SCORE_0.78', output:'加权投票仲裁结论'},
  {id:'human_arbitration', name:'人工复核仲裁Agent', layer:'仲裁层', role:'独立仲裁组件：风险冲突时转人工确认队列', icon:'♙', risk:'MEDIUM', latency:0, status:'WAITING', input:'冲突项/风险项', evidence:'WAIT_OPERATOR', output:'等待人工仲裁'}
);

function getArbitrationMode(){
  return localStorage.getItem(FLOW_ARBITRATION_MODE_KEY) || 'safety_veto';
}

function setArbitrationMode(mode){
  const next = ARBITRATION_MODES[mode] ? mode : 'safety_veto';
  localStorage.setItem(FLOW_ARBITRATION_MODE_KEY, next);
  applyArbitrationMode();
  persistFlowCanvas();
}

function applyArbitrationMode(){
  const mode = ARBITRATION_MODES[getArbitrationMode()] || ARBITRATION_MODES.safety_veto;
  const meta = FLOW_NODE_META.fusion_arbitration;
  Object.assign(meta, {
    mode: mode.label,
    risk: mode.risk,
    status: mode.status,
    evidence: mode.evidence,
    output: mode.output,
    role: `仲裁模式：${mode.label}。${mode.desc}`
  });
  const node = getFlowNode('fusion_arbitration');
  if(node){
    const p = node.querySelector('p');
    if(p) p.textContent = mode.label + ' · ' + mode.rule;
    const badge = node.querySelector('.badge');
    if(badge && !running) badge.textContent = 'WAITING';
    let mark = node.querySelector('.arbitration-mode-mark');
    if(!mark){ mark = document.createElement('small'); mark.className = 'arbitration-mode-mark'; node.appendChild(mark); }
    mark.textContent = `模式：${mode.label}`;
  }
}

function isFlowModuleNode(id){ return id === 'control_task' || id === 'archive'; }

function makeNodeVisibleForProgressiveFlow(node){
  if(!node) return;
  node.classList.remove('future-node');
  node.classList.add('revealed-node');
}
function makeNodeHiddenForProgressiveFlow(node){
  if(!node) return;
  node.classList.add('future-node');
  node.classList.remove('revealed-node','active','connect-source');
}

function revealCanvasNodeForProgressiveFlow(id){
  const node = getFlowNode(id);
  makeNodeVisibleForProgressiveFlow(node);
  const incoming = flowConnections.filter(([from,to]) => to === id).map(([from]) => from);
  incoming.forEach(from => makeNodeVisibleForProgressiveFlow(getFlowNode(from)));
  redrawFlowCanvas();
}

function prepareProgressiveExecution(){
  allFlowNodes().forEach(node => {
    if(node.classList.contains('node-disabled')) return;
    makeNodeHiddenForProgressiveFlow(node);
    setStatus(node.dataset.node, 'WAITING');
  });
  Array.from(document.querySelectorAll('.flow-canvas-line')).forEach(line => line.classList.remove('flow-line-visible','active'));
  const roots = computeFlowLevels()[0] || ['state_capture'];
  roots.forEach(id => revealCanvasNodeForProgressiveFlow(id));
  $('focusLabel').textContent = '等待状态帧采集';
  redrawFlowCanvas();
}

function buildFlowToolbar(){
  const panel = $('tree-panel');
  const head = panel?.querySelector('.panel-head');
  if(!panel || !head || panel.querySelector('.flow-builder-toolbar')) return;
  const toolbar = document.createElement('div');
  toolbar.className = 'flow-builder-toolbar arbitration-toolbar';
  toolbar.dataset.noOverlay = 'true';
  const options = Object.entries(ARBITRATION_MODES).map(([key, m]) => `<option value="${key}"${key===getArbitrationMode()?' selected':''}>${m.label}</option>`).join('');
  toolbar.innerHTML = `
    <button type="button" data-flow-action="run-default">一键执行默认配置</button>
    <button type="button" data-flow-action="run-current">执行当前画布</button>
    <button type="button" data-flow-action="add-agent">添加Agent/仲裁组件</button>
    <button type="button" data-flow-action="connect-mode">连线模式</button>
    <button type="button" data-flow-action="clear-lines">清空连线</button>
    <button type="button" data-flow-action="save-flow">保存画布</button>
    <button type="button" data-flow-action="reset-flow">恢复默认</button>
    <label class="arbitration-mode-select">仲裁模式 <select id="arbitrationModeSelect" data-no-overlay="true">${options}</select></label>
  `;
  head.appendChild(toolbar);
  const viewport = getFlowViewport();
  if(viewport && !viewport.querySelector('#flowAgentLibrary')){
    const lib = document.createElement('div');
    lib.id = 'flowAgentLibrary';
    lib.className = 'flow-agent-library agent-component-library';
    lib.dataset.noOverlay = 'true';
    lib.innerHTML = `<div class="flow-agent-library-head"><b>Agent与仲裁组件库</b><button type="button" data-flow-action="close-agent-library">×</button></div><p>选择Agent或仲裁组件后加入画布，可拖动位置、手动连线，也可删除自己添加的节点。</p><div class="agent-lib-section"><h4>专业Agent</h4><div class="agent-lib-list" data-lib="agent"></div></div><div class="agent-lib-section"><h4>仲裁Agent / 仲裁组件</h4><div class="agent-lib-list" data-lib="arbitration"></div></div>`;
    const listAgent = lib.querySelector('[data-lib="agent"]');
    const listArb = lib.querySelector('[data-lib="arbitration"]');
    AGENT_CATALOG.forEach(agent => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.addAgentId = agent.id;
      btn.innerHTML = `<span>${agent.icon}</span><b>${agent.name}</b><small>${agent.layer} · ${agent.role}</small>`;
      const isArb = String(agent.layer).includes('仲裁') || String(agent.name).includes('仲裁');
      (isArb ? listArb : listAgent).appendChild(btn);
    });
    viewport.appendChild(lib);
  }
  const hint = document.createElement('div');
  hint.id = 'flowCanvasHint';
  hint.className = 'flow-canvas-hint';
  hint.textContent = '工业级流程画布：默认配置会逐步生成流程；自定义Agent可添加、拖动、连线、删除；控制任务生成和报告归档是模块，不计入Agent。';
  viewport?.appendChild(hint);
  applyArbitrationMode();
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
  const isArb = String(data.layer).includes('仲裁') || String(data.name).includes('仲裁');
  node.className = `tree-node ${isArb ? 'fusion' : 'agent'} custom-agent flow-canvas-node status-waiting revealed-node`;
  node.dataset.node = id;
  node.dataset.customType = isArb ? 'arbitration' : 'agent';
  node.style.left = `${Math.max(20, Math.min(viewport.clientWidth - 230, 60 + customAgentCounter * 36))}px`;
  node.style.top = `${Math.max(40, Math.min(viewport.clientHeight - 160, 110 + customAgentCounter * 22))}px`;
  node.dataset.positionLocked = 'true';
  node.innerHTML = `<button type="button" class="node-delete-btn" data-flow-action="remove-node" data-node-id="${escapeHtml(id)}" title="删除这个自定义节点" data-no-overlay="true">×</button><em>${data.icon}</em><h3>${escapeHtml(data.name)}</h3><span class="badge">WAITING</span><p>输入摘要：${escapeHtml(data.input)}</p><p>证据：${escapeHtml(data.evidence)}</p><p>输出结论：${escapeHtml(data.output)}</p><strong>风险 ${escapeHtml(data.risk)}</strong><small>${Number(data.latency || 0)}ms</small><div class="node-work-summary">${escapeHtml(data.role)}</div>`;
  viewport.appendChild(node);
  FLOW_NODE_META[id] = {...data, id};
  attachNodeEnableToggle(node);
  makeNodeDraggable(node);
  if(isArb){
    parallelAgentIds.forEach(pid => { if(getFlowNode(pid)) flowConnections.push([pid, id]); });
    if(getFlowNode('control_task')) flowConnections.push([id, 'control_task']);
  }else{
    if(getFlowNode('context_model')) flowConnections.push(['context_model', id]);
    if(getFlowNode('fusion_arbitration')) flowConnections.push([id, 'fusion_arbitration']);
  }
  flowConnections = normalizeFlowConnections(flowConnections);
  redrawFlowCanvas();
  persistFlowCanvas();
  setCanvasHint(`已添加 ${data.name}，可拖动位置、手动连线；自定义节点右上角×可以删除。`);
}

function removeCustomAgentFromCanvas(id){
  const node = getFlowNode(id);
  if(!node || !node.classList.contains('custom-agent')){
    showSystemNotice('不能删除默认节点', '默认主干节点不能删除，可以使用“启用/停用”控制是否参与当前画布执行。', '知道了');
    return;
  }
  const name = getNodeMeta(id).name || id;
  node.remove();
  flowConnections = normalizeFlowConnections(flowConnections.filter(([from,to]) => from !== id && to !== id));
  delete FLOW_NODE_META[id];
  redrawFlowCanvas();
  persistFlowCanvas();
  setCanvasHint(`已删除自定义节点：${name}`);
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
  applyArbitrationMode();
  redrawFlowCanvas();
  setCanvasHint('已恢复默认多Agent协同流程。执行后将按工业状态帧、专家审查、融合仲裁与任务生成顺序逐步展开。');
}

function persistFlowCanvas(){
  const nodes = allFlowNodes().map(node => ({
    id: node.dataset.node,
    custom: node.classList.contains('custom-agent'),
    customType: node.dataset.customType || '',
    disabled: node.classList.contains('node-disabled'),
    left: node.style.left || '',
    top: node.style.top || '',
    html: node.classList.contains('custom-agent') ? node.innerHTML : null,
    className: node.className
  }));
  const payload = {nodes, connections: flowConnections, arbitrationMode:getArbitrationMode(), savedAt: new Date().toISOString()};
  localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(payload));
}

function loadFlowCanvas(){
  try{
    const raw = localStorage.getItem(FLOW_STORAGE_KEY);
    if(!raw){ flowConnections = DEFAULT_FLOW_CONNECTIONS.map(x => [...x]); applyArbitrationMode(); return; }
    const payload = JSON.parse(raw);
    if(payload.arbitrationMode) localStorage.setItem(FLOW_ARBITRATION_MODE_KEY, payload.arbitrationMode);
    document.querySelectorAll('#treeViewport .custom-agent').forEach(n => n.remove());
    const viewport = getFlowViewport();
    (payload.nodes || []).forEach(record => {
      if(record.custom && record.id && record.html){
        const node = document.createElement('article');
        node.id = `node-${record.id}`;
        node.dataset.node = record.id;
        node.dataset.customType = record.customType || '';
        node.className = record.className || 'tree-node agent custom-agent flow-canvas-node status-waiting revealed-node';
        node.innerHTML = record.html;
        if(!node.querySelector('.node-delete-btn')){
          node.insertAdjacentHTML('afterbegin', `<button type="button" class="node-delete-btn" data-flow-action="remove-node" data-node-id="${escapeHtml(record.id)}" title="删除这个自定义节点" data-no-overlay="true">×</button>`);
        }
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
    applyArbitrationMode();
  }catch(e){
    console.warn('流程画布加载失败，使用默认流程', e);
    flowConnections = DEFAULT_FLOW_CONNECTIONS.map(x => [...x]);
    applyArbitrationMode();
  }
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
  const orderScore = id => {
    if(id === 'state_capture') return 0;
    if(id === 'context_model') return 1;
    if(id.includes('arbitration') || id === 'fusion_arbitration') return 8;
    if(id === 'control_task') return 9;
    if(id === 'archive') return 10;
    const idx = nodeIds.indexOf(id);
    return idx === -1 ? 5 : idx;
  };
  while(queue.length){
    const level = queue.filter(id => !seen.has(id));
    if(!level.length) break;
    levels.push(level.sort((a,b) => orderScore(a)-orderScore(b)));
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
  if(missed.length) levels.push(missed.sort((a,b) => orderScore(a)-orderScore(b)));
  return levels;
}

function canvasStatusFor(id, runningStatus=false){
  if(runningStatus) return 'RUNNING';
  if(id === 'fusion_arbitration') return ARBITRATION_MODES[getArbitrationMode()]?.status || 'LIMITED';
  if(isFlowModuleNode(id)) return 'PASS';
  const meta = getNodeMeta(id);
  return meta.status || 'PASS';
}

function buildCanvasAgentPanel(id, status){
  const meta = getNodeMeta(id);
  if(id === 'fusion_arbitration'){
    const m = ARBITRATION_MODES[getArbitrationMode()] || ARBITRATION_MODES.safety_veto;
    return {name: `${meta.name}（${m.label}）`, status, risk:m.risk, latency:`${meta.latency || 188}ms`, input:'专家Agent结论集合、风险分值、动作权限矩阵', rule:m.rule, evidence:m.evidence, suggestion:`按“${m.label}”输出：${m.output}`, tool:'VoteFusion / SafetyVeto / ArbitrationModeSelector', work:[`读取所有并行专家Agent输出`, `执行仲裁模式：${m.label}`, `形成最终动作建议：${m.output}`]};
  }
  if(isFlowModuleNode(id)){
    return {name: meta.name, status, risk: meta.risk || 'LOW', latency:`${meta.latency || 0}ms`, input: meta.input || '上游仲裁结果', rule: `${id.toUpperCase()}_MODULE_RULE`, evidence: meta.evidence || 'MODULE_READY', suggestion:`该节点是平台模块，不作为Agent投票成员；作用：${meta.role}`, tool: `${meta.name} / PlatformModule`, work:[`读取上游决策结果`, `执行模块功能：${meta.role}`, `形成输出：${meta.output || '模块输出完成'}`]};
  }
  return {name: meta.name, status, risk: meta.risk || 'LOW', latency:`${meta.latency || 0}ms`, input: meta.input || '当前画布上游节点输出', rule:`${id.toUpperCase()}_FLOW_RULE`, evidence: meta.evidence || 'FLOW_CANVAS_EVIDENCE', suggestion: status === 'BLOCKED' ? '触发安全否决，建议重新规划或人工复核' : `根据当前画布依赖执行：${meta.output || '输出审理结论'}`, tool:`${meta.name} / FlowCanvas / PolicyMatrix`, work:[`读取上游画布节点输入：${meta.input || '上游输出'}`, `执行职责：${meta.role || '自定义Agent职责'}`, `形成输出：${meta.output || '写入多Agent决策上下文'}`]};
}

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
  if(useDefault) prepareProgressiveExecution();
  appendLog(`${useDefault ? '默认配置逐步执行' : '当前画布开始执行'}：${getEnabledNodeIds().length} 个节点，${flowConnections.length} 条依赖连线。`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
  for(const level of levels){
    if(!running) break;
    level.forEach(id => { revealCanvasNodeForProgressiveFlow(id); });
    await sleep(useDefault ? 450 : 80);
    level.forEach(id => {
      setCanvasNodeStatus(id, 'RUNNING');
      getFlowNode(id)?.classList.add('active');
      updateAgentPanel(buildCanvasAgentPanel(id, 'RUNNING'));
      $('focusLabel').textContent = level.length > 1 ? `并行决策：${level.length}个节点` : getNodeMeta(id).name;
    });
    redrawFlowCanvas();
    const names = level.map(id => getNodeMeta(id).name).join('、');
    const agentCount = level.filter(id => !isFlowModuleNode(id)).length;
    appendLog(`${level.length > 1 ? '并行审查' : '单节点审查'}：${names} 正在处理${agentCount !== level.length ? '（含平台模块）' : ''}。`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    await sleep((useDefault ? 2350 : 2100) + Math.min(level.length, 6) * 320);
    level.forEach(id => {
      const finalStatus = canvasStatusFor(id, false);
      setCanvasNodeStatus(id, finalStatus);
      getFlowNode(id)?.classList.remove('active');
      updateAgentPanel(buildCanvasAgentPanel(id, finalStatus));
      appendLog(`[${getNodeMeta(id).name}] 输出：${getNodeMeta(id).output || finalStatus} / 状态 ${finalStatus}`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    });
    await sleep(520);
  }
  updateTask({task_id:'TASK_FLOW_CANVAS_022', type:'PICK_AND_PLACE', safety_mode:'LIMITED'});
  $('focusLabel').textContent = '流程画布执行完成';
  $('agentBus').textContent = 'DONE';
  if(btn){ btn.dataset.completed = 'true'; btn.innerHTML = '<span>✓</span>决策完成，可重新启动'; }
  running = false;
}

function startDecision(){ return startCanvasDecision(false); }

function agentRoleCardsHtml(){
  return AGENT_ROLE_DETAILS.map((a, idx) => {
    const isModule = String(a.name).includes('模块');
    return `<article class="agent-role-card clickable-agent-card ${isModule ? 'module-role-card' : ''}" data-agent-index="${idx}" title="点击查看${escapeHtml(a.name)}的决策依据">
      <div class="agent-role-index">${String(idx + 1).padStart(2,'0')}</div>
      <div class="agent-role-main">
        <div class="agent-role-title"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.layer)}</span></div>
        <p><strong>${isModule ? '模块作用' : '作用'}：</strong>${escapeHtml(a.role)}</p>
        <p><strong>输入：</strong>${escapeHtml(a.input)}</p>
        <p><strong>工作：</strong>${escapeHtml(a.work)}</p>
        <p><strong>输出：</strong>${escapeHtml(a.output)}</p>
        <small class="agent-click-hint">点击查看：数据支持 / 决策规则 / 工具调用 / 为什么这样判断</small>
      </div>
      <em class="risk-${String(a.risk).toLowerCase()}">${isModule ? 'MODULE' : escapeHtml(a.risk)}</em>
    </article>`;
  }).join('');
}

function buildAgentRoleMapView(){
  const wrap = document.createElement('div');
  wrap.className = 'agent-role-map-view';
  wrap.innerHTML = `
    <section class="module-detail-hero">
      <div><span>AGENT ROLE MAP</span><h3>本平台使用的Agent与分工</h3><p>下面展示每个Agent在决策链路中的作用、输入、工作内容和输出结果。控制任务生成与报告归档是平台模块，不参与Agent投票。</p></div>
      <b>10 个Agent / 2 个平台模块 / 多种仲裁模式</b>
    </section>
    <section class="agent-role-grid">${agentRoleCardsHtml()}</section>`;
  return wrap;
}

function refreshWorkflowLabels(){
  const logoVer = document.querySelector('.brand small');
  if(logoVer) logoVer.textContent = 'V3.2';
  const mapBtn = document.querySelector('.agent-map-trigger');
  if(mapBtn) mapBtn.innerHTML = '参与Agent：<b>10</b> 个 + 模块 <b>2</b> 个 · 查看作用';
  const controlNode = getFlowNode('control_task');
  controlNode?.classList.add('module-node');
  const archiveNode = getFlowNode('archive');
  archiveNode?.classList.add('module-node');
  const controlH = controlNode?.querySelector('h3'); if(controlH) controlH.textContent = '控制任务生成模块';
  const archiveH = archiveNode?.querySelector('h3'); if(archiveH) archiveH.textContent = '报告归档模块';
  applyArbitrationMode();
}

document.addEventListener('click', (e) => {
  const remove = e.target.closest('[data-flow-action="remove-node"]');
  if(remove){
    e.preventDefault(); e.stopPropagation();
    removeCustomAgentFromCanvas(remove.dataset.nodeId);
  }
}, true);

document.addEventListener('change', (e) => {
  if(e.target && e.target.id === 'arbitrationModeSelect'){
    setArbitrationMode(e.target.value);
    setCanvasHint(`已切换仲裁模式：${ARBITRATION_MODES[e.target.value]?.label || '安全否决优先'}。后续执行会按该模式融合多Agent结果。`);
  }
}, true);

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    refreshWorkflowLabels();
    const select = $('arbitrationModeSelect');
    if(select) select.value = getArbitrationMode();
    setCanvasHint('V3.2：默认配置执行会逐步生成流程；自定义节点可删除；仲裁Agent单独配置；控制任务生成和报告归档是平台模块。');
  }, 180);
});


