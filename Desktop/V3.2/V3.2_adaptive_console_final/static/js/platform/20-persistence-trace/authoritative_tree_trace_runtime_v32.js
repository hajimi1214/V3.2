/*
 * V3.2 authoritative tree + deep trace runtime
 * - 决策树刷新/切页持久化兜底
 * - 自动决策阶段日志扩写与定时输出
 * - 单路阶段约 2s，并行审理阶段约 3s
 */
(function installAuthoritativeTreeTraceRuntime(){
  const SESSION_KEY = 'zltx_decision_session_v33';
  const TRACE_MAX = 140;
  const SINGLE_STAGE_MS = 2000;
  const PARALLEL_STAGE_MS = 3000;
  const STAGE_SETTLE_MS = 180;
  const nativeSleep = typeof window.sleep === 'function'
    ? window.sleep
    : (ms => new Promise(resolve => window.setTimeout(resolve, ms)));

  function nowText(){
    return new Date().toLocaleTimeString('zh-CN', {hour12:false});
  }
  function safeJson(raw, fallback=null){
    try{ return JSON.parse(raw || 'null') ?? fallback; }
    catch(err){ return fallback; }
  }
  function readSession(){
    return safeJson(localStorage.getItem(SESSION_KEY), null);
  }
  function allDecisionNodeIds(){
    return (typeof nodeIds !== 'undefined' && Array.isArray(nodeIds))
      ? nodeIds
      : (Array.isArray(window.nodeIds) ? window.nodeIds : []);
  }
  function currentFlowMode(){
    return typeof flowCanvasMode !== 'undefined' ? flowCanvasMode : window.flowCanvasMode;
  }
  function functionRef(name){
    try{
      if(name === 'getNodeMeta' && typeof getNodeMeta === 'function') return getNodeMeta;
      if(name === 'prepareDeviceGatedStepTopology' && typeof prepareDeviceGatedStepTopology === 'function') return prepareDeviceGatedStepTopology;
      if(name === 'computeDefaultLevels' && typeof computeDefaultLevels === 'function') return computeDefaultLevels;
      if(name === 'revealExecutionFlowNode' && typeof revealExecutionFlowNode === 'function') return revealExecutionFlowNode;
      if(name === 'setCanvasNodeStatus' && typeof setCanvasNodeStatus === 'function') return setCanvasNodeStatus;
      if(name === 'updateAgentPanel' && typeof updateAgentPanel === 'function') return updateAgentPanel;
      if(name === 'buildCanvasAgentPanel' && typeof buildCanvasAgentPanel === 'function') return buildCanvasAgentPanel;
      if(name === 'drawVisibleExecutionFlowLines' && typeof drawVisibleExecutionFlowLines === 'function') return drawVisibleExecutionFlowLines;
      if(name === 'redrawFlowCanvas' && typeof redrawFlowCanvas === 'function') return redrawFlowCanvas;
      if(name === 'localizeVisibleStatuses' && typeof localizeVisibleStatuses === 'function') return localizeVisibleStatuses;
      if(name === 'canvasStatusFor' && typeof canvasStatusFor === 'function') return canvasStatusFor;
      if(name === 'updateTask' && typeof updateTask === 'function') return updateTask;
      if(name === 'localizedStatusText' && typeof localizedStatusText === 'function') return localizedStatusText;
      if(name === 'isDeviceConnected' && typeof isDeviceConnected === 'function') return isDeviceConnected;
      if(name === 'showSystemNotice' && typeof showSystemNotice === 'function') return showSystemNotice;
      if(name === 'routeToModule' && typeof routeToModule === 'function') return routeToModule;
      if(name === 'updateRunGate' && typeof updateRunGate === 'function') return updateRunGate;
      if(name === 'syncAgentReviewMirror' && typeof syncAgentReviewMirror === 'function') return syncAgentReviewMirror;
    }catch(err){}
    return window[name];
  }
  function visibleDecisionNodes(){
    const ids = allDecisionNodeIds();
    return ids.filter(id => {
      const node = document.getElementById(`node-${id}`);
      return Boolean(node && !node.classList.contains('future-node') && !node.classList.contains('workflow-node-hidden'));
    });
  }
  function nodeStatusSnapshot(){
    const out = {};
    const ids = allDecisionNodeIds();
    ids.forEach(id => {
      const badge = document.querySelector(`#node-${id} .badge`);
      if(badge) out[id] = badge.textContent.trim();
    });
    return out;
  }
  function logSnapshot(id){
    return Array.from(document.querySelectorAll(`#${id} p`)).map(p => (p.textContent || '').trim()).filter(Boolean);
  }
  function textOf(id){
    return document.getElementById(id)?.textContent?.trim() || '';
  }
  function agentWorkSnapshot(){
    return Array.from(document.querySelectorAll('#agentWork li')).map(li => li.textContent.trim()).filter(Boolean);
  }
  function agentPanelSnapshot(){
    return {
      name: textOf('agentStatusTag').replace(/\s+(WAITING|RUNNING|PASS|DONE|LIMITED|BLOCKED|完成|运行中|通过|受限|阻断)$/u, '') || '当前Agent',
      statusLabel: textOf('agentStatusTag'),
      input: textOf('agentInput'),
      rule: textOf('agentRule'),
      evidence: textOf('agentEvidence'),
      suggestion: textOf('agentSuggestion'),
      tool: textOf('agentTool'),
      risk: textOf('agentRisk'),
      latency: textOf('agentLatency'),
      work: agentWorkSnapshot(),
    };
  }
  function hasMeaningfulSession(session=readSession()){
    if(!session || typeof session !== 'object') return false;
    const revealed = Array.isArray(session.revealed_nodes) ? session.revealed_nodes.length : 0;
    const statusCount = session.node_status && typeof session.node_status === 'object' ? Object.keys(session.node_status).length : 0;
    const bus = String(session.bus_state || '').trim();
    const task = String(session.task_json || '').trim();
    return Boolean(session.decision_started)
      || Boolean(session.start_completed)
      || revealed > 1
      || statusCount > 1
      || /DONE|RUNNING|完成|运行中/u.test(bus)
      || (task && !/WAITING_FOR_DECISION|WAIT_DEVICE_OR_REVIEW|"status"\s*:\s*"EMPTY"/u.test(task));
  }
  window.__zltxHasPersistedDecisionSession = hasMeaningfulSession;

  function writeLine(containerId, line, max=TRACE_MAX){
    const host = document.getElementById(containerId);
    if(!host || !line) return;
    const p = document.createElement('p');
    p.textContent = `${nowText()} ${line}`;
    host.prepend(p);
    while(host.children.length > max) host.removeChild(host.lastChild);
  }
  function processLine(line){ writeLine('decisionProcessLog', line, TRACE_MAX); }
  function agentLine(line){ writeLine('agentDecisionLog', line, TRACE_MAX); }
  window.__zltxPushProcessTrace = processLine;
  window.__zltxPushAgentTrace = agentLine;

  function persistAuthoritativeSession(eventData={}){
    try{
      const bus = document.getElementById('agentBus');
      const startBtn = document.getElementById('startBtn');
      const task = document.getElementById('taskJson');
      const visible = visibleDecisionNodes();
      const activeRunning = typeof running !== 'undefined' ? Boolean(running) : false;
      const session = {
        version: 'V3.2',
        saved_at: new Date().toISOString(),
        running: activeRunning,
        bus_state: bus?.dataset?.state || bus?.textContent?.trim() || '',
        start_completed: Boolean(startBtn?.dataset?.completed),
        focus_label: textOf('focusLabel'),
        node_status: nodeStatusSnapshot(),
        revealed_nodes: visible,
        decision_started: activeRunning || Boolean(startBtn?.dataset?.completed) || visible.length > 1,
        agent_panel: agentPanelSnapshot(),
        task_json: task?.textContent || '',
        flow_logs: logSnapshot('decisionProcessLog'),
        agent_logs: logSnapshot('agentDecisionLog'),
        last_event: eventData || {},
      };
      const previous = readSession();
      const previousMeaningful = hasMeaningfulSession(previous);
      const nextMeaningful = hasMeaningfulSession(session);
      const eventType = String(eventData?.type || '');
      const explicitClear = /CLEAR|CLEARED|DELETE/u.test(eventType);
      if(previousMeaningful && !nextMeaningful && !explicitClear){
        return previous;
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    }catch(err){
      console.warn('V3.2 决策会话持久化失败', err);
      return null;
    }
  }
  window.persistDecisionSession = persistAuthoritativeSession;

  const originalRestoreDecisionSession = typeof window.restoreDecisionSession === 'function' ? window.restoreDecisionSession : null;
  function restoreAuthoritativeSession(){
    const session = readSession();
    if(!hasMeaningfulSession(session)) return originalRestoreDecisionSession?.();
    try{
      document.body.classList.remove('empty-workflow-flow','no-device-execution-flow');
      document.body.classList.add('compact-workflow-flow','execution-step-flow');
      originalRestoreDecisionSession?.();
      window.redrawFlowCanvas?.();
      window.syncAgentReviewMirror?.();
      window.localizeVisibleStatuses?.();
    }catch(err){
      console.warn('V3.2 决策会话恢复失败', err);
    }
  }
  window.restoreDecisionSession = restoreAuthoritativeSession;

  function scheduleRestore(reason='route'){
    if(!hasMeaningfulSession()) return;
    [40, 180, 520].forEach(ms => window.setTimeout(() => {
      restoreAuthoritativeSession();
      document.body.dataset.authoritativeTreeRestore = `${reason}-${ms}`;
    }, ms));
  }

  const originalEmptyCanvas = typeof window.emptyDecisionCanvas === 'function' ? window.emptyDecisionCanvas : null;
  window.emptyDecisionCanvas = function(force=false){
    if(!force && hasMeaningfulSession()){
      scheduleRestore('empty-blocked');
      return false;
    }
    return originalEmptyCanvas?.apply(this, arguments);
  };

  const originalClearNoDevice = typeof window.clearDecisionTreeForNoDevice === 'function' ? window.clearDecisionTreeForNoDevice : null;
  window.clearDecisionTreeForNoDevice = function(force=false){
    if(!force && hasMeaningfulSession()){
      scheduleRestore('nodevice-blocked');
      return false;
    }
    return originalClearNoDevice?.apply(this, arguments);
  };

  const originalRouteToModule = typeof window.routeToModule === 'function' ? window.routeToModule : null;
  if(originalRouteToModule){
    window.routeToModule = function(targetId='workbench', title){
      const ret = originalRouteToModule.apply(this, arguments);
      if(['workbench','tree-panel','agent-review','trace-archive'].includes(String(targetId)) && hasMeaningfulSession()){
        scheduleRestore(`route-${targetId}`);
      }
      return ret;
    };
  }

  function traceLibrary(id){
    const getMeta = functionRef('getNodeMeta');
    const meta = typeof getMeta === 'function' ? getMeta(id) : {name:id, output:'审理完成'};
    const libs = {
      state_capture: [
        '[状态采集] 读取 CameraBus.FRAME_1245、DepthBus.CLOUD_0891、PLC.IOMAP@A03，并完成状态帧时间戳对齐，Δt=0.8ms。',
        '[接口完整性] CRC16=PASS，急停链=RELEASED，安全门=DELAY_CONFIRM，气压=0.48MPa，机械臂控制器=ONLINE。',
        '[状态帧封装] 生成 frame_id=FRM-20260509-001245，写入设备上下文、视觉上下文与安全上下文，等待任务建模。',
      ],
      context_model: [
        '[任务建模] 识别任务=PICK_AND_PLACE，关联模型能力=YOLO铜箔检测 / SGBM双目测距 / 图像修复质量复核。',
        '[上下文拆解] 将同一状态帧分流为视觉质量、三维定位、放置规划、硬件联锁、安全策略、执行约束六路审理。',
        '[依赖关系] 生成 DAG：状态帧→上下文建模→并行审理→融合仲裁→控制任务→Trace归档。',
      ],
      vision_quality: [
        '[视觉质量Agent] 接收 ROI#COPPER_ROLL_0981 与修复后图像，规则=VISION_CONFIDENCE_GT_0.85。',
        '[视觉判据] bbox_conf=0.98、遮挡率=4.2%、纹理一致性=0.94、边缘缺失率=1.1%，满足进入抓取链路条件。',
        '[决策理由] 目标边界完整且分类稳定，降低误抓概率，输出=PASS，允许进入三维定位与轨迹规划。',
      ],
      localization_3d: [
        '[三维定位Agent] 融合 SGBM 深度图与点云 ROI，求解抓取位姿 T_base_tool，规则=DEPTH_RMSE_LT_0.5MM。',
        '[定位证据] Z=245.21mm、RMSE=0.21mm、姿态偏角=1.7°、空间置信度=0.96，均处于工艺容差范围内。',
        '[决策理由] 深度残差低且可达性预检通过，输出=PASS，将位姿约束下发给放置规划Agent。',
      ],
      placement_plan: [
        '[放置规划Agent] 根据目标位姿、AGV缓冲位与机器人运动学边界生成 3 条候选路径。',
        '[路径评分] path#1=0.71、path#2=0.64、path#3=0.32；碰撞间隙最小值=18mm，节拍裕度=1.8s。',
        '[决策理由] 第3候选路径总代价最低且可在限速策略下执行，输出=PASS，建议作为控制任务主轨迹。',
      ],
      hardware_interlock: [
        '[硬件联锁Agent] 校验 PLC 输入 DI_07/DI_12、光栅、急停回路、安全门闭合反馈与末端夹具压力。',
        '[联锁证据] E_STOP=OFF、LIGHT_CURTAIN=CLEAR、DOOR_LOCK=DELAY_CONFIRM、VACUUM=86%，链路未失联。',
        '[决策理由] 安全门存在延迟确认但满足受限运行门槛，输出=LIMITED，禁止原速下发。',
      ],
      safety_strategy: [
        '[安全策略Agent] 执行 SAFETY_FIRST 策略树，优先审查人员防护、越权指令、禁区穿越与保护停止条件。',
        '[策略匹配] 命中 POLICY-SF-03：联锁、安全门与急停状态均正常，进入标准执行模式。',
        '[决策理由] 当前风险可控但不满足全速执行，输出=PASS_WITH_LIMIT，交由融合仲裁统一裁决。',
      ],
      execution_constraint: [
        '[执行约束Agent] 读取 J1-J6 扭矩裕度、末端负载、速度曲线与 jerk_limit，执行边界校验。',
        '[约束证据] J2 扭矩裕度=9.4%，低于原速策略阈值 12%；末端载荷=62%，夹具姿态稳定。',
        '[决策理由] 原速度直接执行存在机械冲击风险，输出=BLOCKED_RAW_SPEED，建议降速 30% 后重算任务。',
      ],
      fusion_arbitration: [
        '[融合仲裁] 汇总 6 路审理结论：视觉PASS、定位PASS、规划PASS、联锁LIMITED、安全PASS_WITH_LIMIT、执行约束BLOCKED_RAW_SPEED。',
        '[冲突消解] 采用 weighted_vote + safety_veto 双机制：完成多路一致性判断，标准执行条件全部通过。',
        '[仲裁结论] final_action=PICK_AND_PLACE，速度缩放=1.00，写入 dispatch_mode=AUTO_AFTER_ARBITRATION。',
      ],
      control_task: [
        '[控制任务生成] 组装 task_id=TASK_20260509_00187，写入 target_device=ARM_01，transport=TCP Socket。',
        '[动作编排] 生成 MOVEJ→MOVEL→VISION_RECHECK→GRIPPER_CLOSE→LIFT→PLACE→RETURN_SAFE 十步动作序列。',
        '[权限矩阵] ack_required=true，ack_timeout=350ms，stop_conditions=E_STOP/DOOR_OPEN/CRC_FAIL/TORQUE_J2_HIGH。',
      ],
      archive: [
        '[Trace归档] 写入决策树快照、Agent审理证据、仲裁理由、控制任务JSON与状态帧摘要。',
        '[追溯索引] trace_id=TRACE-20260509-00187，evidence_digest=SHA256:9C4E...A21F，支持后续复盘。',
        '[归档结论] 本轮决策已闭环，平台将保持树图与日志直到用户主动清理。',
      ],
    };
    return libs[id] || [
      `[${meta.name || id}] 接收上游状态与任务上下文，进入规则审理。`,
      `[${meta.name || id}] 规则匹配完成，证据=${meta.evidence || 'TRACE_EVIDENCE_READY'}。`,
      `[${meta.name || id}] 输出=${meta.output || '审理完成'}，写入决策Trace。`,
    ];
  }

  function processStageIntro(level, durationMs){
    const getMeta = functionRef('getNodeMeta');
    const names = level.map(id => getMeta?.(id)?.name || id).join('、');
    const title = level.length > 1 ? '多路并行审理' : '单节点审理';
    processLine(`[阶段启动] ${title}：${names}；本阶段计划窗口≈${Math.round(durationMs/1000)}s。`);
  }
  async function emitTraceLines(level, durationMs){
    const lines = level.flatMap(id => traceLibrary(id));
    if(!lines.length) return;
    const interval = Math.max(120, Math.floor((durationMs * 0.72) / lines.length));
    for(const line of lines){
      agentLine(line);
      await nativeSleep(interval);
    }
  }
  function finalStageDecision(level){
    level.forEach(id => {
      const getMeta = functionRef('getNodeMeta');
      const statusFor = functionRef('canvasStatusFor');
      const meta = getMeta?.(id) || {name:id, output:'审理完成'};
      const finalStatus = statusFor?.(id, false) || 'PASS';
      agentLine(`[阶段输出] ${meta.name || id} => ${finalStatus}；结论=${meta.output || finalStatus}；状态写入仲裁证据链。`);
    });
  }

  const originalStartCanvasDecision = typeof window.startCanvasDecision === 'function' ? window.startCanvasDecision : null;
  window.startCanvasDecision = async function(useDefault=false){
    if(!useDefault) return originalStartCanvasDecision?.apply(this, arguments);
    if(typeof running !== 'undefined' && running) return;
    const connected = functionRef('isDeviceConnected');
    const notice = functionRef('showSystemNotice');
    const route = functionRef('routeToModule');
    const gateUpdate = functionRef('updateRunGate');
    if(!connected?.()){
      window.clearDecisionTreeForNoDevice?.(false);
      notice?.('暂无设备连接', '请先进入「系统配置」完成设备接入；未连接设备时禁止启动自动决策。', '进入系统配置', () => route?.('config', '系统配置'));
      processLine('[启动拦截] 未检测到已连接设备，自动决策未启动。');
      persistAuthoritativeSession({type:'START_BLOCKED_NO_DEVICE'});
      gateUpdate?.();
      return;
    }

    const prepareTopology = functionRef('prepareDeviceGatedStepTopology');
    const computeLevels = functionRef('computeDefaultLevels');
    const ok = prepareTopology?.();
    if(ok === false) return;
    const levels = typeof computeLevels === 'function'
      ? computeLevels()
      : [['state_capture'], ['context_model'], ['vision_quality','localization_3d','placement_plan','hardware_interlock','safety_strategy','execution_constraint'], ['fusion_arbitration'], ['control_task'], ['archive']];
    if(typeof running !== 'undefined') running = true;
    document.body.classList.remove('empty-workflow-flow','no-device-execution-flow');
    document.body.classList.add('workflow-template-running','execution-step-flow','compact-workflow-flow');
    const bus = document.getElementById('agentBus');
    const localize = functionRef('localizedStatusText');
    if(bus){ bus.dataset.state = 'RUNNING'; bus.textContent = localize?.('RUNNING') || '运行中'; }
    const btn = document.getElementById('startBtn');
    if(btn){ delete btn.dataset.completed; btn.innerHTML = '<span>●</span>多Agent智能决策运行中...'; }
    processLine(`[决策启动] 自动决策流开始，阶段数=${levels.length}，并行审理窗口将单独按 3s 展开。`);
    agentLine('[编排器] 已锁定本轮工业状态帧与模型能力清单，后续树图、日志、控制任务将写入同一决策会话。');
    persistAuthoritativeSession({type:'FLOW_START'});

    for(let stageIndex=0; stageIndex<levels.length; stageIndex+=1){
      if(typeof running !== 'undefined' && !running) break;
      const level = levels[stageIndex];
      const isParallel = level.length > 1;
      const durationMs = isParallel ? PARALLEL_STAGE_MS : SINGLE_STAGE_MS;
      const stageStartedAt = Date.now();
      processStageIntro(level, durationMs);
      level.forEach(id => {
        const revealNodeFn = functionRef('revealExecutionFlowNode');
        const node = revealNodeFn?.(id) || document.getElementById(`node-${id}`);
        if(!node) return;
        const setCanvasStatus = functionRef('setCanvasNodeStatus');
        const updatePanel = functionRef('updateAgentPanel');
        const buildPanel = functionRef('buildCanvasAgentPanel');
        setCanvasStatus?.(id, 'RUNNING');
        node.classList.add('active');
        updatePanel?.(buildPanel?.(id, 'RUNNING'));
      });
      const focus = document.getElementById('focusLabel');
      const getMeta = functionRef('getNodeMeta');
      const drawLines = functionRef('drawVisibleExecutionFlowLines');
      const redraw = functionRef('redrawFlowCanvas');
      const localizeVisible = functionRef('localizeVisibleStatuses');
      if(focus) focus.textContent = isParallel ? `多Agent并行审理：${level.length}路证据同步收敛` : (getMeta?.(level[0])?.name || 'Agent审理中');
      drawLines?.();
      redraw?.();
      localizeVisible?.();
      persistAuthoritativeSession({type:'STAGE_RUNNING', stage_index:stageIndex, nodes:level});
      await emitTraceLines(level, durationMs);
      const spent = Date.now() - stageStartedAt;
      if(spent < durationMs) await nativeSleep(durationMs - spent);
      level.forEach(id => {
        const node = document.getElementById(`node-${id}`);
        if(!node) return;
        const statusFor = functionRef('canvasStatusFor');
        const setCanvasStatus = functionRef('setCanvasNodeStatus');
        const updatePanel = functionRef('updateAgentPanel');
        const buildPanel = functionRef('buildCanvasAgentPanel');
        const finalStatus = statusFor?.(id, false) || 'PASS';
        setCanvasStatus?.(id, finalStatus);
        node.classList.remove('active');
        updatePanel?.(buildPanel?.(id, finalStatus));
      });
      finalStageDecision(level);
      processLine(`[阶段完成] ${isParallel ? '并行审理' : '单节点审理'}已收敛，树图状态、审理结果和输出日志同步固化。`);
      const drawLinesDone = functionRef('drawVisibleExecutionFlowLines');
      const redrawDone = functionRef('redrawFlowCanvas');
      const localizeDone = functionRef('localizeVisibleStatuses');
      drawLinesDone?.();
      redrawDone?.();
      localizeDone?.();
      persistAuthoritativeSession({type:'STAGE_DONE', stage_index:stageIndex, nodes:level});
      await nativeSleep(STAGE_SETTLE_MS);
    }

    const updateTaskFn = functionRef('updateTask');
    updateTaskFn?.({task_id:'TASK_FLOW_CANVAS_032', type:'PICK_AND_PLACE', safety_mode:'LIMITED', speed_scale:0.7});
    const focus = document.getElementById('focusLabel');
    if(focus) focus.textContent = '决策闭环完成：控制任务已生成并进入待确认';
    const doneBus = document.getElementById('agentBus');
    const localizeDoneBus = functionRef('localizedStatusText');
    if(doneBus){ doneBus.dataset.state = 'DONE'; doneBus.textContent = localizeDoneBus?.('DONE') || '完成'; }
    if(btn){ btn.dataset.completed = 'true'; btn.innerHTML = '<span>✓</span>决策完成，可重新启动'; }
    if(typeof running !== 'undefined') running = false;
    document.body.classList.remove('workflow-template-running');
    processLine('[决策完成] 树图、日志、控制任务与审理摘要已保存；刷新或切换页面后仍将保持。');
    agentLine('[会话固化] persisted=true，清理条件=仅在用户主动点击“清理决策”后删除。');
    const drawFinal = functionRef('drawVisibleExecutionFlowLines');
    const redrawFinal = functionRef('redrawFlowCanvas');
    const localizeFinal = functionRef('localizeVisibleStatuses');
    drawFinal?.();
    redrawFinal?.();
    localizeFinal?.();
    persistAuthoritativeSession({type:'FLOW_DONE'});
  };
  window.startDecision = function(){
    return currentFlowMode() === 'auto' ? window.startCanvasDecision(true) : window.startCanvasDecision(false);
  };

  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-flow-action]')?.dataset.flowAction;
    if(action === 'clear-canvas'){
      window.clearDecisionSession?.();
      originalEmptyCanvas?.call(window, true);
    }
  }, false);

  document.addEventListener('DOMContentLoaded', () => {
    [1680, 2280, 3080].forEach(ms => window.setTimeout(() => scheduleRestore(`boot-${ms}`), ms));
  });
  window.addEventListener('pageshow', () => scheduleRestore('pageshow'));
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible') scheduleRestore('visible');
  });
})();
