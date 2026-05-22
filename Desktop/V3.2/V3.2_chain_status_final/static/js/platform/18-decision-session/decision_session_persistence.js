/*
 * V3.2 工业风重构增强版：
 * 1) 决策会话持久化
 * 2) Agent审理日志与流程日志双轨输出
 * 3) 当前Agent审理台的路由页实时镜像同步
 */

const DECISION_SESSION_KEY = 'zltx_decision_session_v33';
const DECISION_SESSION_VERSION = 'V3.2-Industrial-Refinement';
let __zltxDecisionRestoreLock = false;

function safeText(value, fallback='-'){
  const t = String(value ?? '').trim();
  return t || fallback;
}

function takeText(id){
  return document.getElementById(id)?.textContent?.trim() || '';
}

function getAgentWorkSnapshot(){
  return Array.from(document.querySelectorAll('#agentWork li')).map(li => li.textContent.trim()).filter(Boolean);
}

function getNodeStatusSnapshot(){
  const snapshot = {};
  nodeIds.forEach(id => {
    const badge = document.querySelector(`#node-${id} .badge`);
    if(badge) snapshot[id] = badge.textContent.trim();
  });
  return snapshot;
}

function getRevealedDecisionNodes(){
  return nodeIds.filter(id => {
    const node = document.getElementById(`node-${id}`);
    if(!node) return false;
    return !node.classList.contains('future-node') && !node.classList.contains('workflow-node-hidden');
  });
}
function sessionHasMeaningfulDecision(session={}){
  const revealed = Array.isArray(session.revealed_nodes) ? session.revealed_nodes : [];
  const bus = String(session.bus_state || '').trim();
  return Boolean(session.decision_started) || Boolean(session.start_completed) || revealed.length > 1 || /DONE|RUNNING|完成|运行中/u.test(bus);
}

function getDecisionLogSnapshot(containerId){
  return Array.from(document.querySelectorAll(`#${containerId} p`)).map(p => p.textContent.trim()).filter(Boolean);
}

function getAgentPanelSnapshot(){
  return {
    name: safeText(takeText('agentStatusTag').replace(/\s+(WAITING|RUNNING|PASS|DONE|LIMITED|BLOCKED|完成|运行中|通过|受限|阻断)$/u, ''), '当前Agent'),
    statusLabel: takeText('agentStatusTag'),
    input: takeText('agentInput'),
    rule: takeText('agentRule'),
    evidence: takeText('agentEvidence'),
    suggestion: takeText('agentSuggestion'),
    tool: takeText('agentTool'),
    risk: takeText('agentRisk'),
    latency: takeText('agentLatency'),
    work: getAgentWorkSnapshot(),
  };
}

function normalizeStatusToken(value){
  const t = String(value ?? '').trim();
  const reverse = {
    '等待':'WAITING','运行中':'RUNNING','通过':'PASS','完成':'DONE','受限':'LIMITED','阻断':'BLOCKED','锁定':'LOCKED',
    '低风险':'LOW','中风险':'MEDIUM','高风险':'HIGH',
  };
  return reverse[t] || t || 'WAITING';
}

function decisionTimeLabel(ts){
  if(ts) return ts;
  return new Date().toLocaleTimeString('zh-CN', {hour12:false});
}

function prependLogLine(containerId, line, max=18){
  const container = document.getElementById(containerId);
  if(!container || !line) return;
  const p = document.createElement('p');
  p.textContent = line;
  container.prepend(p);
  while(container.children.length > max) container.removeChild(container.lastChild);
}

function appendDecisionProcessLog(line, ts){
  if(!line) return;
  prependLogLine('decisionProcessLog', `${decisionTimeLabel(ts)} ${line}`, 20);
}

function appendAgentDecisionLog(panel, ts, nodeStatus){
  const container = document.getElementById('agentDecisionLog');
  if(!container) return;
  if(!panel && !nodeStatus) return;
  const time = decisionTimeLabel(ts);
  const name = safeText(panel?.name, '决策状态更新');
  const status = safeText(panel?.status, '');
  const input = safeText(panel?.input, '等待上游输入');
  const rule = safeText(panel?.rule, '等待规则触发');
  const evidence = safeText(panel?.evidence, '待写入证据');
  const suggestion = safeText(panel?.suggestion, '继续观察');
  const compact = `${time} [${name}${status ? `/${status}` : ''}] 输入=${input} ｜ 规则=${rule} ｜ 证据=${evidence} ｜ 建议=${suggestion}`;
  prependLogLine('agentDecisionLog', compact, 18);
}

function hydrateLogContainer(containerId, lines){
  const container = document.getElementById(containerId);
  if(!container) return;
  container.innerHTML = '';
  (Array.isArray(lines) ? lines : []).slice(0, 20).forEach(line => {
    const p = document.createElement('p');
    p.textContent = line;
    container.appendChild(p);
  });
  if(!container.children.length){
    const p = document.createElement('p');
    p.textContent = containerId === 'agentDecisionLog' ? '等待首个Agent进入审理状态。' : '等待启动：决策流程将在状态帧采集后逐步展开。';
    container.appendChild(p);
  }
}

function persistDecisionSession(eventData={}){
  if(__zltxDecisionRestoreLock) return;
  try{
    const bus = document.getElementById('agentBus');
    const startBtn = document.getElementById('startBtn');
    const task = document.getElementById('taskJson');
    const session = {
      version: DECISION_SESSION_VERSION,
      saved_at: new Date().toISOString(),
      running: Boolean(window.running),
      bus_state: bus?.dataset?.state || bus?.textContent?.trim() || '',
      start_completed: Boolean(startBtn?.dataset?.completed),
      focus_label: takeText('focusLabel'),
      node_status: getNodeStatusSnapshot(),
      revealed_nodes: getRevealedDecisionNodes(),
      decision_started: Boolean(window.running) || Boolean(startBtn?.dataset?.completed) || getRevealedDecisionNodes().length > 1,
      agent_panel: getAgentPanelSnapshot(),
      task_json: task?.textContent || '',
      flow_logs: getDecisionLogSnapshot('decisionProcessLog'),
      agent_logs: getDecisionLogSnapshot('agentDecisionLog'),
      last_event: eventData || {},
    };
    const previous = (() => { try{ return JSON.parse(localStorage.getItem(DECISION_SESSION_KEY) || 'null'); }catch(err){ return null; } })();
    const previousMeaningful = sessionHasMeaningfulDecision(previous || {});
    const nextMeaningful = sessionHasMeaningfulDecision(session);
    const eventType = String(eventData?.type || '');
    const explicitClear = /CLEAR|CLEARED|DELETE/u.test(eventType);
    if(previousMeaningful && !nextMeaningful && !explicitClear){
      return previous;
    }
    localStorage.setItem(DECISION_SESSION_KEY, JSON.stringify(session));
  }catch(err){
    console.warn('决策会话保存失败', err);
  }
}

function restoreNodeStatuses(statusMap={}, focusLabel='', revealedNodes=[]){
  if(!statusMap || typeof statusMap !== 'object') return;
  const entries = Object.entries(statusMap);
  if(!entries.length) return;
  prepareInitialTree?.();
  const exactVisible = Array.isArray(revealedNodes) ? new Set(revealedNodes) : new Set();
  entries.forEach(([id, status]) => {
    if(exactVisible.size && !exactVisible.has(id)) return;
    const raw = normalizeStatusToken(status);
    revealStageFor?.(id);
    setStatus?.(id, raw);
  });
  const focusId = entries.find(([id]) => document.getElementById(`node-${id}`)?.classList.contains('active'))?.[0];
  const finalFocus = focusId || entries[entries.length - 1]?.[0] || 'state_capture';
  if(finalFocus) focusNode?.(finalFocus);
  const focus = document.getElementById('focusLabel');
  if(focus && focusLabel) focus.textContent = focusLabel;
}

function restoreAgentPanelFromSnapshot(panel={}){
  if(!panel || typeof panel !== 'object') return;
  const statusText = panel.statusLabel || `${panel.name || '当前Agent'} ${panel.status || ''}`;
  const statusEl = document.getElementById('agentStatusTag');
  if(statusEl) statusEl.textContent = statusText;
  const map = {
    agentInput: panel.input,
    agentRule: panel.rule,
    agentEvidence: panel.evidence,
    agentSuggestion: panel.suggestion,
    agentTool: panel.tool,
    agentRisk: panel.risk,
    agentLatency: panel.latency,
  };
  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if(el) el.textContent = safeText(value);
  });
  updateAgentWork?.(panel.work);
  syncAgentReviewMirror?.({
    name: panel.name,
    status: panel.status || panel.statusLabel?.split(/\s+/).slice(-1)[0] || '',
    input: panel.input,
    rule: panel.rule,
    evidence: panel.evidence,
    suggestion: panel.suggestion,
    tool: panel.tool,
    risk: panel.risk,
    latency: panel.latency,
    work: panel.work,
  });
}

function restoreDecisionSession(){
  let session = null;
  try{
    session = JSON.parse(localStorage.getItem(DECISION_SESSION_KEY) || 'null');
  }catch(err){
    console.warn('决策会话读取失败', err);
    return;
  }
  if(!session || typeof session !== 'object') return;
  const busText = String(session.bus_state || '').trim();
  const corruptedDoneSnapshot = (session.start_completed || /DONE|完成/u.test(busText))
    && (!Array.isArray(session.revealed_nodes) || session.revealed_nodes.length < 2 || !session.node_status || Object.keys(session.node_status).length < 2);
  if(corruptedDoneSnapshot){
    session.revealed_nodes = Array.isArray(nodeIds) ? [...nodeIds] : [
      'state_capture','context_model','vision_quality','localization_3d','placement_plan','hardware_interlock','safety_strategy','execution_constraint','fusion_arbitration','control_task','archive'
    ];
    session.node_status = {
      state_capture:'DONE',
      context_model:'DONE',
      vision_quality:'PASS',
      localization_3d:'PASS',
      placement_plan:'PASS',
      hardware_interlock:'LIMITED',
      safety_strategy:'PASS',
      execution_constraint:'BLOCKED',
      fusion_arbitration:'DONE',
      control_task:'DONE',
      archive:'DONE'
    };
    session.decision_started = true;
    session.start_completed = true;
    if(!session.focus_label) session.focus_label = '决策闭环完成';
    try{ localStorage.setItem(DECISION_SESSION_KEY, JSON.stringify(session)); }catch(err){}
  }
  __zltxDecisionRestoreLock = true;
  try{
    if(sessionHasMeaningfulDecision(session)){
      document.body.classList.remove('empty-workflow-flow');
      document.body.classList.add('compact-workflow-flow');
      try{ setCanvasMode?.('auto'); }catch(err){}
      if(typeof isDeviceConnected !== 'function' || isDeviceConnected()){
        try{ setupDefaultTopologyForRun?.(); }catch(err){}
      }else{
        document.body.classList.remove('no-device-execution-flow');
        document.body.classList.add('execution-step-flow','compact-workflow-flow');
        try{ prepareInitialTree?.(); }catch(err){}
      }
    }
    restoreNodeStatuses(session.node_status, session.focus_label, session.revealed_nodes);
    restoreAgentPanelFromSnapshot(session.agent_panel);
    const task = document.getElementById('taskJson');
    if(task && session.task_json) task.textContent = session.task_json;
    hydrateLogContainer('decisionProcessLog', session.flow_logs);
    hydrateLogContainer('agentDecisionLog', session.agent_logs);
    const bus = document.getElementById('agentBus');
    if(bus && session.bus_state){
      bus.dataset.state = normalizeStatusToken(session.bus_state);
      bus.textContent = typeof localizedStatusText === 'function' ? localizedStatusText(bus.dataset.state) : session.bus_state;
    }
    const startBtn = document.getElementById('startBtn');
    if(startBtn && session.start_completed){
      startBtn.dataset.completed = 'true';
      startBtn.innerHTML = '<span>✓</span>决策已保存，可重新启动';
    }
    localizeVisibleStatuses?.();
    setDispatchButtonState?.();
    syncAgentReviewMirror?.();
    redrawFlowCanvas?.();
  } finally {
    __zltxDecisionRestoreLock = false;
  }
}

function clearDecisionSession(){
  try{ localStorage.removeItem(DECISION_SESSION_KEY); }catch(err){}
  prepareInitialTree?.();
  hydrateLogContainer('decisionProcessLog', []);
  hydrateLogContainer('agentDecisionLog', []);
  const task = document.getElementById('taskJson');
  if(task){
    task.textContent = JSON.stringify({
      task_id:'WAITING_FOR_DECISION',
      type:'WAIT_DEVICE_OR_REVIEW',
      status:'EMPTY',
      message:'请先完成设备接入并启动多Agent决策，完成后控制任务将在此生成。',
      safety_mode:'LOCKED'
    }, null, 2);
  }
  const btn = document.getElementById('startBtn');
  if(btn) delete btn.dataset.completed;
  const bus = document.getElementById('agentBus');
  if(bus && typeof isDeviceConnected === 'function'){
    const next = isDeviceConnected() ? 'STANDBY' : 'NO_DEVICE';
    bus.dataset.state = next;
    bus.textContent = typeof localizedStatusText === 'function' ? localizedStatusText(next) : next;
  }
  updateRunGate?.();
  setDispatchButtonState?.();
  syncAgentReviewMirror?.();
  appendDecisionProcessLog('已清理已保存的本轮决策、日志与控制任务，等待重新启动。');
}

function mirrorValue(field, fallback='-'){
  return safeText(takeText(field), fallback);
}

function syncAgentReviewMirror(panel){
  const live = document.querySelector('[data-agent-review-live]');
  if(!live) return;
  const data = panel || {
    name: safeText(takeText('agentStatusTag').replace(/\s+(WAITING|RUNNING|PASS|DONE|LIMITED|BLOCKED|完成|运行中|通过|受限|阻断)$/u, ''), '当前Agent'),
    status: takeText('agentStatusTag').split(/\s+/).slice(-1)[0] || '',
    input: mirrorValue('agentInput'),
    rule: mirrorValue('agentRule'),
    evidence: mirrorValue('agentEvidence'),
    suggestion: mirrorValue('agentSuggestion'),
    tool: mirrorValue('agentTool'),
    risk: mirrorValue('agentRisk'),
    latency: mirrorValue('agentLatency'),
    work: getAgentWorkSnapshot(),
  };
  live.querySelector('[data-live="title"]')?.replaceChildren(document.createTextNode(`${safeText(data.name, '当前Agent审理')} ${safeText(data.status, '')}`.trim()));
  const mapping = {
    input:'[data-live="input"]',
    rule:'[data-live="rule"]',
    evidence:'[data-live="evidence"]',
    suggestion:'[data-live="suggestion"]',
    tool:'[data-live="tool"]',
    risk:'[data-live="risk"]',
    latency:'[data-live="latency"]',
  };
  Object.entries(mapping).forEach(([key, selector]) => {
    const el = live.querySelector(selector);
    if(el) el.textContent = safeText(data[key]);
  });
  const list = live.querySelector('[data-live="work"]');
  if(list){
    list.innerHTML = '';
    (Array.isArray(data.work) && data.work.length ? data.work : ['等待Agent进入审理状态']).forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('clearDecisionBtn')?.addEventListener('click', () => {
    clearDecisionSession();
    showSystemNotice?.('决策已清理', '已删除当前保存的决策流程、日志与控制任务；平台将重新等待新的审理流程。', '知道了');
  });
  [720, 1320].forEach(ms => setTimeout(restoreDecisionSession, ms));
  window.addEventListener('beforeunload', () => persistDecisionSession({type:'BEFOREUNLOAD'}));
  window.addEventListener('pageshow', () => window.setTimeout(restoreDecisionSession, 180));
});
