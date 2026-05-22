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
  viewport.scrollTo({left: target, top: viewport.scrollTop, behavior: 'smooth'});
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
  syncAgentReviewMirror?.(panel);
}

function appendLog(line, ts){
  if(!line) return;
  const feed = $('logFeed');
  if(!feed) return;
  const p = document.createElement('p');
  p.textContent = `${ts || new Date().toLocaleTimeString()} ${line}`;
  feed.prepend(p);
  while(feed.children.length > 8) feed.removeChild(feed.lastChild);
}

function updateTask(task){
  const taskEl = $('taskJson');
  if(!taskEl) return;
  if(!task && !isDeviceConnected?.()) {
    taskEl.textContent = JSON.stringify({
      task_id:'WAITING_FOR_DECISION',
      type:'WAIT_DEVICE_OR_REVIEW',
      status:'EMPTY',
      message:'设备未接入或决策尚未完成，控制任务等待生成。',
      safety_mode:'LOCKED'
    }, null, 2);
    return;
  }
  if(!isDeviceConnected?.()){
    taskEl.textContent = JSON.stringify({
      task_id:'LOCKED_NO_DEVICE',
      type:'WAIT_DEVICE',
      status:'BLOCKED',
      reason:'未接入硬件设备，禁止生成真实控制任务',
      required_steps:[
        '系统配置 -> 设备参数',
        '确认设备IP、端口、协议',
        '联锁、急停、CRC全部通过'
      ],
      safety_mode:'LOCKED'
    }, null, 2);
    return;
  }
  const speedScale = Number(task?.speed_scale ?? 1.0);
  const obj = {
    task_id: task?.task_id || 'TASK_20260509_00187',
    task_type: task?.type || 'PICK_AND_PLACE',
    task_version: '3.2.1-industrial',
    dispatch_mode: 'AUTO_AFTER_ARBITRATION',
    decision_ref: {
      frame_id: $('frameId')?.textContent?.trim() || 'FRM-20260509-001245',
      decision_id: $('decisionId')?.textContent?.trim() || 'DEC-20260509-00187',
      arbitration_policy: 'SAFETY_FIRST',
      source_agent: '控制任务生成Agent'
    },
    target_device: {
      arm_id: task?.arm_id || 'DEVICE-001',
      workcell: 'CopperRoll-PickPlace-01',
      controller: 'PLC-A03',
      transport: 'TCP Socket'
    },
    precheck: {
      device_connected: true,
      crc_verified: true,
      estop_released: true,
      safety_door: 'CONFIRMED',
      pressure_mpa: 0.48,
      permission_matrix: 'ALLOW'
    },
    command_bundle: {
      coordinate_system: 'BASE',
      tool_frame: 'GRIPPER_TCP_V2',
      speed_scale: speedScale,
      accel_scale: 0.55,
      jerk_limit: 'SAFE_PROFILE_B',
      valid_until: '2026-05-09T16:15:00Z'
    },
    trajectory: [
      { step: 1, action: 'SET_MODE', mode: 'NORMAL', note: '安全仲裁通过，进入标准执行' },
      { step: 2, action: 'MOVEJ', target: 'HOME_SAFE', joint_deg: [0, -35, 68, 0, 57, 0], tolerance_mm: 0.8 },
      { step: 3, action: 'MOVEL', target: 'PRE_PICK', pose_mm_deg: [412.6, -183.2, 268.5, 180, 0, 90], speed_mm_s: 220 },
      { step: 4, action: 'VISION_RECHECK', roi: 'COPPER_ROLL_0981', timeout_ms: 320, on_fail: 'ABORT_AND_REPLAN' },
      { step: 5, action: 'MOVEL', target: 'PICK_POSE', pose_mm_deg: [412.6, -183.2, 212.8, 180, 0, 90], speed_mm_s: 110 },
      { step: 6, action: 'GRIPPER', channel: 'DO_07', command: 'CLOSE', confirm_signal: 'DI_12', timeout_ms: 180 },
      { step: 7, action: 'LIFT', delta_z_mm: 95, speed_mm_s: 95 },
      { step: 8, action: 'MOVEL', target: 'PLACE_BUFFER', pose_mm_deg: [635.4, 112.8, 305.0, 180, 0, 90], speed_mm_s: 180 },
      { step: 9, action: 'GRIPPER', channel: 'DO_07', command: 'OPEN', confirm_signal: 'DI_13', timeout_ms: 180 },
      { step: 10, action: 'RETURN_SAFE', target: 'HOME_SAFE', speed_scale: 1.0 }
    ],
    safeguards: {
      safety_mode: task?.safety_mode || 'NORMAL',
      stop_conditions: ['E_STOP', 'DOOR_OPEN', 'CRC_FAIL', 'TORQUE_J2_HIGH'],
      fallback_policy: 'SAFE_STOP_THEN_WAIT_OPERATOR',
      max_joint_torque_margin: '>=12%',
      trace_writeback: true
    },
    ack_policy: {
      required: true,
      ack_timeout_ms: 350,
      retry: 1,
      manual_release: true
    },
    lifecycle_state: 'WAIT_OPERATOR_CONFIRM'
  };
  taskEl.textContent = JSON.stringify(obj, null, 2);
}

