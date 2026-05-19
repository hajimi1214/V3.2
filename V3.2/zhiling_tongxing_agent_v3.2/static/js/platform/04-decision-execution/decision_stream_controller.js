function clearLinesAndNodes(){
  nodeIds.forEach(hideNode);
  document.querySelector('.add-agent')?.classList.add('future-node');
  document.querySelectorAll('.flow-line').forEach(line => line.classList.remove('line-visible','link-live'));
}

function prepareInitialTree(){
  clearLinesAndNodes();
  revealNode('state_capture');
  setStatus('state_capture','WAITING');
  nodeEl('state_capture')?.classList.add('active');
  $('focusLabel').textContent = '等待状态帧采集';
  $('agentStatusTag').textContent = '等待状态帧采集Agent WAITING';
  updateAgentPanel({
    name:'等待状态帧采集Agent',
    status:'WAITING',
    risk:'-',
    latency:'-',
    input:'等待双目相机、AGV视觉和PLC联锁状态帧',
    rule:'WAIT_FOR_INDUSTRIAL_STATE_FRAME',
    evidence:'尚未启动Agent审理，等待状态帧触发',
    suggestion:'点击启动按钮后由状态帧触发决策流程',
    tool:'CameraBus / PLCBus / AgentOrchestrator',
    work:['等待工业状态帧采集','等待上游算法输出接入','等待多Agent协同审查启动']
  });
}

function resetRun(){
  prepareInitialTree();
  $('logFeed').innerHTML = '';
  appendLog('等待启动：下游Agent不会预先展开，流程由状态帧逐步触发。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
}

function handleStep(data){
  if(data.focus_node) revealStageFor(data.focus_node);
  if(data.node_status){
    Object.entries(data.node_status).forEach(([id, st]) => setStatus(id, st));
    // 同一事件里多个Agent RUNNING时，模拟真正并行审理，所有活跃Agent同步发出粒子特效。
    Object.entries(data.node_status).forEach(([id, st]) => {
      if(String(st).toUpperCase() === 'RUNNING') emitNodeParticles(id, parallelAgentIds.includes(id) ? 'parallel' : 'normal');
    });
  }
  if(data.focus_node) focusNode(data.focus_node);
  if(data.agent_panel) updateAgentPanel(data.agent_panel);
  if(data.task) updateTask(data.task);
  if(data.log) appendLog(data.log, data.ts);
  if(data.final){
    running = false;
    $('agentBus').textContent = 'DONE';
    $('startBtn').dataset.completed = 'true';
        $('startBtn').innerHTML = '<span>✓</span>决策完成，可重新启动';
  }
}

function startDecision(){
  if(running) return;
  if(!isDeviceConnected()){
    showSystemNotice('暂无设备连接', '请先进入「系统配置 → 设备参数」，填写设备信息并连接成功后再启动多Agent决策。', '进入系统配置', () => openModuleOverlay('config', '系统配置中心'));
    appendLog('启动被拦截：未检测到已连接硬件设备，禁止执行多Agent决策。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    updateRunGate();
    return;
  }
  running = true;
  $('agentBus').textContent = 'RUNNING';
  delete $('startBtn').dataset.completed;
  $('startBtn').innerHTML = '<span>●</span>多Agent审理中...';
  resetRun();
  if(source){ source.close(); source = null; }
  source = new EventSource('/api/decision/stream?delay=2.35');
  source.onmessage = (event) => {
    try{
      const data = JSON.parse(event.data);
      if(data.done){
        source.close(); source = null; running = false;
        $('agentBus').textContent = 'DONE';
        $('startBtn').dataset.completed = 'true';
        $('startBtn').innerHTML = '<span>✓</span>决策完成，可重新启动';
        return;
      }
      handleStep(data);
    }catch(e){ console.error(e); }
  };
  source.onerror = () => {
    appendLog('SSE连接异常，已停止本次演示。', new Date().toLocaleTimeString());
    if(source){ source.close(); source = null; }
    running = false;
    $('agentBus').textContent = 'ERROR';
    $('startBtn').innerHTML = '<span>▶</span>采集工业状态帧并启动决策';
  };
}

