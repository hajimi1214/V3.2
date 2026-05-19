function revealStageFor(nodeId){
  // 让流程像真实 Agent 一样“逐步生成”：未到达节点不出现，到达后才解锁。
  if(nodeId === 'state_capture') {
    revealNode('state_capture');
    return;
  }
  if(nodeId === 'context_model') {
    revealNode('state_capture'); revealNode('context_model');
    revealLine('line-state_capture-context_model', true);
    return;
  }
  if(parallelAgentIds.includes(nodeId)) {
    revealNode('state_capture'); revealNode('context_model');
    parallelAgentIds.forEach(revealNode);
    document.querySelector('.add-agent')?.classList.remove('future-node');
    revealLine('line-state_capture-context_model');
    revealLine('line-context_model-branch', true);
    revealLine('line-branch-bus', true);
    revealLine('line-agent-stems', true);
    return;
  }
  if(nodeId === 'fusion_arbitration') {
    revealStageFor('placement_plan');
    revealNode('fusion_arbitration');
    revealLine('line-merge-bus', true);
    return;
  }
  if(nodeId === 'control_task') {
    revealStageFor('fusion_arbitration');
    revealNode('control_task');
    revealLine('line-fusion-control', true);
    return;
  }
  if(nodeId === 'archive') {
    revealStageFor('control_task');
    revealNode('archive');
    revealLine('line-control-archive', true);
    return;
  }
}

function setActiveLines(nodeId){
  clearLiveLines();
  if(nodeId === 'context_model') revealLine('line-state_capture-context_model', true);
  if(parallelAgentIds.includes(nodeId)) {
    revealLine('line-context_model-branch', true);
    revealLine('line-branch-bus', true);
    revealLine('line-agent-stems', true);
  }
  if(nodeId === 'fusion_arbitration') revealLine('line-merge-bus', true);
  if(nodeId === 'control_task') revealLine('line-fusion-control', true);
  if(nodeId === 'archive') revealLine('line-control-archive', true);
}

function emitNodeParticles(nodeId, intensity='normal'){
  const node = nodeEl(nodeId);
  if(!node) return;
  const old = node.querySelector('.particle-burst');
  if(old) old.remove();
  const burst = document.createElement('div');
  burst.className = 'particle-burst ' + intensity;
  const count = intensity === 'parallel' ? 14 : 18;
  for(let i=0;i<count;i++){
    const particle = document.createElement('span');
    const angle = (Math.PI * 2 * i / count) + (Math.random() * 0.45);
    const dist = 46 + Math.random() * 46;
    particle.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    particle.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
    particle.style.setProperty('--delay', `${Math.random() * 0.35}s`);
    particle.style.setProperty('--size', `${2 + Math.random() * 3}px`);
    burst.appendChild(particle);
  }
  node.appendChild(burst);
  setTimeout(() => burst.remove(), 2100);
}

function setStatus(nodeId, status){
  const node = nodeEl(nodeId);
  if(!node) return;
  revealNode(nodeId);
  node.classList.remove('status-pass','status-done','status-running','status-limited','status-blocked','status-waiting','active');
  const normalized = String(status || 'WAITING').toLowerCase();
  const cls = normalized === 'done' ? 'status-done' : 'status-' + normalized;
  node.classList.add(cls);
  const badge = node.querySelector('.badge');
  if(badge) badge.textContent = status;
  if(normalized === 'running') {
    emitNodeParticles(nodeId, parallelAgentIds.includes(nodeId) ? 'parallel' : 'normal');
  }
}

function focusNode(nodeId){
  revealStageFor(nodeId);
  nodeIds.forEach(id => nodeEl(id)?.classList.remove('active'));
  const node = nodeEl(nodeId);
  if(!node) return;
  node.classList.add('active');
  $('focusLabel').textContent = nodeName[nodeId] || nodeId;
  setActiveLines(nodeId);
  const viewport = $('treeViewport');
  // 预留给后续升级：如果树图宽度超过一屏，视角自动跟随当前 Agent。
  const nodeLeft = node.offsetLeft;
  const target = Math.max(0, nodeLeft - viewport.clientWidth / 2 + node.clientWidth / 2);
  viewport.scrollTo({left: target, behavior: 'smooth'});
}

function updateAgentWork(items){
  const box = $('agentWork');
  if(!box) return;
  const works = Array.isArray(items) && items.length ? items : [
    '等待工业状态帧触发，不预先展示下游Agent结论',
    '启动后由上游Agent输出决定下一阶段是否生成',
    '并行审查阶段会同时激活多个专业Agent'
  ];
  box.innerHTML = works.map(item => `<li>${item}</li>`).join('');
}

function updateAgentPanel(panel){
  if(!panel) return;
  $('agentStatusTag').textContent = `${panel.name || '当前Agent'} ${panel.status || ''}`;
  $('agentInput').textContent = panel.input || '-';
  $('agentRule').textContent = panel.rule || '-';
  $('agentEvidence').textContent = panel.evidence || '-';
  $('agentSuggestion').textContent = panel.suggestion || '-';
  $('agentTool').textContent = panel.tool || '-';
  $('agentRisk').textContent = panel.risk || '-';
  $('agentLatency').textContent = panel.latency || '-';
  updateAgentWork(panel.work);
}

function appendLog(line, ts){
  if(!line) return;
  const feed = $('logFeed');
  const p = document.createElement('p');
  p.textContent = `${ts || new Date().toLocaleTimeString()} ${line}`;
  feed.prepend(p);
  while(feed.children.length > 8) feed.removeChild(feed.lastChild);
}

function updateTask(task){
  if(!task) return;
  if(!isDeviceConnected()){
    $('taskJson').textContent = JSON.stringify({
      task_id:'LOCKED_NO_DEVICE',
      type:'WAIT_DEVICE',
      reason:'未接入硬件设备，禁止生成真实控制任务',
      required:'系统配置 -> 设备参数 -> 确认并连接设备',
      safety_mode:'LOCKED'
    }, null, 2);
    return;
  }
  const obj = {
    task_id: task.task_id || 'TASK_20260509_00187',
    type: task.type || 'PICK_AND_PLACE',
    arm_id: task.arm_id || 'ARM_01',
    trajectory: [
      { step: 1, action: 'MOVEJ', pose: '[x,y,z,rx,ry,rz]' },
      { step: 2, action: 'MOVEL', pose: '[x,y,z,rx,ry,rz]' },
      { step: 3, action: 'PICK', gripper: 'CLOSE' }
    ],
    speed_scale: task.speed_scale || 0.7,
    safety_mode: task.safety_mode || 'LIMITED',
    valid_until: '2026-05-09T16:15:00Z'
  };
  $('taskJson').textContent = JSON.stringify(obj, null, 2);
}

