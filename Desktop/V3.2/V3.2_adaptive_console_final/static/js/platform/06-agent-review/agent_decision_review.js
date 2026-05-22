const AGENT_ROLE_DETAILS = [
  {name:'工业状态帧采集Agent', layer:'输入层', role:'采集真实工业状态帧', input:'双目相机、AGV视觉、PLC联锁、CRC', work:'把现场状态封装为标准Frame，作为所有Agent决策起点', output:'FRM-20260509-001245', risk:'LOW'},
  {name:'算法输出接入Agent', layer:'接入层', role:'统一算法模型输出', input:'YOLO、SGBM、AGV定位、图像修复', work:'把算法工程师模型结果转换成Agent可读字段', output:'算法状态包 / ModelPayload', risk:'LOW'},
  {name:'任务上下文建模Agent', layer:'规划层', role:'理解任务和拆分流程', input:'工况、目标、AGV位姿、设备状态', work:'把抓取铜箔任务拆成视觉、定位、规划、联锁、安全、执行约束六路审查', output:'并行审查上下文', risk:'LOW'},
  {name:'视觉质量Agent', layer:'专家层', role:'判断视觉结果是否可信', input:'相机帧、修复图、YOLO目标框', work:'检查置信度、遮挡率、目标完整性，决定是否需要重检', output:'PASS / RECHECK_VISION', risk:'LOW'},
  {name:'三维定位Agent', layer:'专家层', role:'判断定位和深度是否满足抓取', input:'SGBM深度图、点云ROI、目标框', work:'计算Z轴距离、RMSE、抓取点位姿和可达性', output:'三维抓取位姿', risk:'LOW'},
  {name:'放置规划Agent', layer:'专家层', role:'生成放置轨迹候选', input:'目标位姿、AGV放置坐标、机械臂运动学边界', work:'调用IK Solver、路径规划和碰撞检测，输出候选轨迹', output:'第3候选路径 / 限速建议', risk:'MEDIUM'},
  {name:'硬件联锁Agent', layer:'专家层', role:'确认硬件安全链路', input:'PLC I/O、安全门、光栅、气压、电源', work:'判断硬件联锁是否闭合，给出ALLOW/LIMITED/BLOCK', output:'LIMITED / 降级放行', risk:'MEDIUM'},
  {name:'安全策略Agent', layer:'专家层', role:'合成安全风险', input:'策略库、风险阈值、动作权限矩阵', work:'执行安全否决、风险等级合成和动作策略匹配', output:'风险可控 / 可受限执行', risk:'LOW'},
  {name:'执行约束Agent', layer:'专家层', role:'校验执行边界', input:'关节扭矩、负载、速度、轨迹姿态', work:'检查扭矩裕度、末端负载和速度边界，必要时触发限速', output:'BLOCKED转LIMITED', risk:'HIGH'},
  {name:'融合仲裁Agent', layer:'仲裁层', role:'汇总多Agent结论', input:'六路专家Agent输出、证据链、风险等级', work:'执行权重投票、安全否决、冲突消解和最终裁决', output:'PICK_AND_PLACE_LIMITED', risk:'MEDIUM'},
  {name:'控制任务生成Agent', layer:'控制层', role:'生成可执行控制任务', input:'最终动作建议、权限矩阵、设备参数', work:'生成MOVEJ/MOVEL/PICK轨迹序列和安全模式参数', output:'控制任务JSON', risk:'MEDIUM'},
  {name:'报告归档Agent', layer:'归档层', role:'固化证据和报告', input:'Trace、证据链、控制任务、设备编号', work:'归档日志、报告、审计字段和PDF打印模板', output:'REP-20260509-00187', risk:'LOW'}
];

const AGENT_DECISION_SUPPORT = {
  '工业状态帧采集Agent': {
    decision:'是否允许生成工业状态帧并进入任务建模',
    why:'只有相机、AGV视觉、PLC联锁和CRC字段同时可读时，后续Agent才有可信输入。它不是直接下结论，而是先确认“现场数据可用”。',
    rules:['CameraBus帧号连续','PLC联锁字段完整','CRC校验通过','状态帧时间戳小于100ms'],
    data:[['相机帧','CAMERA_FRAME_1245'],['PLC心跳','100ms'],['CRC','PASS'],['急停','OFF']],
    tools:['CameraBus.readFrame()','PLCBus.readSafetyBits()','CRCMonitor.verify()','FrameBuilder.pack()'],
    evidence:['双目相机帧已读取','AGV视觉帧同步成功','PLC安全门/急停/气压字段完整','状态帧可归档'],
    output:'FRM-20260509-001245 / WAIT_MODEL_INPUT'
  },
  '算法输出接入Agent': {
    decision:'是否接收算法模型输出并转成Agent标准输入',
    why:'算法模型输出字段格式不同，不能直接交给审查Agent；该Agent负责统一字段、补充置信度和异常标记。',
    rules:['YOLO置信度>=0.85','SGBM深度RMSE<=0.30mm','AGV位姿可解析','图像修复状态正常'],
    data:[['YOLO置信度','0.98'],['SGBM RMSE','0.21mm'],['AGV坐标','[880,440,20]'],['修复状态','已通过']],
    tools:['YOLOAdapter.normalize()','SGBMAdapter.depthToMetric()','AGVAdapter.poseMap()','ModelPayloadSchema.validate()'],
    evidence:['目标框OBJECT_DETECT_0981','点云POINT_CLOUD_0891','图像修复RESTORE_PASS','AGV定位POSE_3D_0981'],
    output:'ModelPayload / PASS_TO_CONTEXT_AGENT'
  },
  '任务上下文建模Agent': {
    decision:'是否拆解任务并创建并行审查上下文',
    why:'工业任务不是单点判断，必须把“看、识、抓、放、安全、执行”拆成多个职责，才能让专业Agent并行审查。',
    rules:['任务类型为铜箔抓放','目标位姿存在','设备状态字段齐全','权限矩阵模板可用'],
    data:[['任务类型','PICK_AND_PLACE'],['目标对象','铜箔卷'],['候选流程','6路专家审查'],['上下文ID','CTX-00187']],
    tools:['TaskParser.parse()','ContextBuilder.build()','ParallelPlan.expand()','PolicyMatrix.load()'],
    evidence:['任务链路已拆分','专家Agent输入字段已映射','安全策略优先级已加载'],
    output:'ParallelReviewContext / 6_BRANCHES'
  },
  '视觉质量Agent': {
    decision:'是否相信视觉识别结果，是否需要重检',
    why:'抓取任务必须先确认目标完整、置信度足够且不存在严重遮挡，否则会让定位和规划都建立在错误目标上。',
    rules:['目标置信度>=0.90','遮挡率<8%','目标轮廓完整度>=0.92','图像修复质量正常'],
    data:[['YOLO置信度','0.98'],['遮挡率','3.2%'],['轮廓完整度','0.96'],['修复评分','0.94']],
    tools:['VisionQualityCheck.score()','OcclusionDetect.run()','BBoxConsistency.compare()'],
    evidence:['CAMERA_FRAME_1245','OBJECT_DETECT_0981','RESTORE_QUALITY_094'],
    output:'PASS / 视觉质量合格'
  },
  '三维定位Agent': {
    decision:'抓取点位姿是否满足机械臂抓取精度',
    why:'即使视觉识别正确，深度估计不稳定也会造成抓偏或碰撞，因此必须单独检查深度、点云和可达性。',
    rules:['RMSE<=0.25mm','Z轴距离在安全区间','点云ROI完整','抓取点可达'],
    data:[['SGBM深度','245.2mm'],['RMSE','0.21mm'],['点云帧','POINT_CLOUD_0891'],['可达性','TRUE']],
    tools:['SGBMDepth.estimate()','PointCloudROI.filter()','Reachability.check()'],
    evidence:['POINT_CLOUD_0891','DEPTH_MAP_2452','POSE_3D_0981'],
    output:'PASS / 三维抓取位姿'
  },
  '放置规划Agent': {
    decision:'当前AGV放置点和机械臂路径是否可执行',
    why:'抓取成功不等于能安全放置，需要基于AGV位置、工件姿态和机械臂运动学生成候选路径。',
    rules:['路径可行率>=90%','碰撞检测通过','候选路径代价最低','放置姿态误差可接受'],
    data:[['路径可行率','92%'],['候选路径','第3候选'],['碰撞检测','PASS'],['规划耗时','312ms']],
    tools:['IKSolver.solve()','PathPlanner.search()','CollisionCheck.run()','TrajectoryRanker.pick()'],
    evidence:['PATH_PLAN_003','AGV_PLACE_POSE','IK_SOLUTION_03'],
    output:'PASS / 第3候选路径'
  },
  '硬件联锁Agent': {
    decision:'硬件安全链路是否允许动作放行',
    why:'工业控制不能只看算法结果，必须让硬件联锁拥有否决权；安全门延时或气压异常会直接限制动作。',
    rules:['安全门关闭','急停释放','气压>=0.45MPa','控制器心跳正常'],
    data:[['安全门','延时确认'],['急停','OFF'],['气压','0.48MPa'],['PLC心跳','ONLINE']],
    tools:['Interlock.read()','SafetyDoor.check()','PressureSensor.read()','PLCHeartbeat.check()'],
    evidence:['PLC_IO_BITS','SAFETY_DELAY_WARN','PRESSURE_048'],
    output:'LIMITED / 降级放行'
  },
  '安全策略Agent': {
    decision:'综合风险是否允许继续执行',
    why:'安全策略Agent把视觉、定位、联锁、执行约束合成风险等级，并决定是否触发安全否决。',
    rules:['存在BLOCK时触发否决检查','LIMITED需要降级策略','风险等级不得超过HIGH','权限矩阵必须有对应动作'],
    data:[['PASS','3'],['LIMITED','1'],['BLOCKED','1'],['综合风险','MEDIUM']],
    tools:['SafetyVeto.evaluate()','RiskSynthesizer.merge()','PolicyMatrix.match()'],
    evidence:['VISION_PASS','LOCALIZATION_PASS','INTERLOCK_LIMITED','EXEC_BLOCKED'],
    output:'RISK_MEDIUM / 可受限执行'
  },
  '执行约束Agent': {
    decision:'轨迹、扭矩、速度和负载是否超出执行边界',
    why:'该Agent发现J2扭矩逼近上限，不能直接按标准速度执行，所以将动作从正常执行转为限速/受限。',
    rules:['J2扭矩裕度>=15%','末端负载<额定负载','速度缩放<=0.7','轨迹不穿越禁区'],
    data:[['J2扭矩裕度','12%'],['末端负载','4.2kg'],['速度缩放','0.7'],['禁区穿越','FALSE']],
    tools:['TorqueMargin.check()','LoadEstimator.estimate()','SpeedLimiter.apply()','ForbiddenZone.check()'],
    evidence:['TORQUE_J2_WARN','LOAD_42KG','SPEED_SCALE_07'],
    output:'BLOCKED -> LIMITED / 建议限速30%'
  },
  '融合仲裁Agent': {
    decision:'多Agent结论如何融合成最终动作',
    why:'不同Agent可能给出PASS、LIMITED、BLOCKED，仲裁Agent负责权重投票、安全否决和冲突消解。',
    rules:['安全否决优先','硬件联锁权重0.25','安全策略权重0.35','共识阈值>=70%'],
    data:[['通过','3'],['受限','1'],['阻断','1'],['共识度','78%']],
    tools:['VoteFusion.run()','SafetyVeto.resolve()','ConflictResolver.merge()'],
    evidence:['6_AGENT_RESULTS','POLICY_MATRIX','RISK_SYNTHESIS'],
    output:'PICK_AND_PLACE_LIMITED'
  },
  '控制任务生成Agent': {
    decision:'如何把最终动作转成设备可执行控制任务',
    why:'该Agent不会直接控制硬件，而是生成结构化控制任务，并受设备连接状态、权限矩阵和安全模式约束。',
    rules:['设备已连接','动作权限非BLOCK','轨迹参数完整','安全模式写入任务JSON'],
    data:[['动作','PICK_AND_PLACE'],['安全模式','LIMITED'],['速度缩放','0.7'],['设备ID','DEVICE-001']],
    tools:['TaskJsonBuilder.build()','TrajectoryEncoder.encode()','DeviceHandshake.check()'],
    evidence:['ARBITRATION_RESULT','PERMISSION_MATRIX','DEVICE_CONFIG'],
    output:'控制任务JSON / WAIT_DISPATCH'
  },
  '报告归档Agent': {
    decision:'是否生成归档报告和可追溯日志',
    why:'比赛展示和工业复盘都需要证明每一步为什么发生，因此归档Agent固化Trace、证据链和PDF打印内容。',
    rules:['Trace完整','证据链不少于10条','设备编号写入报告','最终决策写入归档'],
    data:[['Trace','12条'],['证据','15条'],['工具调用','7项'],['报告ID','REP-20260509-00187']],
    tools:['TraceCollector.collect()','ArchiveWriter.write()','PdfPrinter.prepare()'],
    evidence:['TRACE_LOG','EVIDENCE_CHAIN','CONTROL_TASK_JSON'],
    output:'REP-20260509-00187 / 可打印PDF'
  }
};

const MODULE_DETAIL_META = {
  'tree-panel': {
    title:'多Agent协同决策树', tag:'MULTI AGENT TOPOLOGY',
    desc:'主干流程逐步生成，并在专家审查层同时展开多个Agent，最后汇聚到融合仲裁Agent。',
    bullets:['状态帧完成后才生成任务建模节点','任务建模完成后并行启动六个专家Agent','仲裁Agent汇总PASS/LIMITED/BLOCKED结论','当前运行节点发光并显示粒子特效']
  },
  'agent-review': {
    title:'当前Agent审理台', tag:'AGENT REVIEW TERMINAL',
    desc:'用于解释当前Agent到底在做什么，而不是只显示一个状态结果。',
    bullets:['显示输入摘要、命中规则、证据理由','展示工具调用和处理建议','同步显示Agent正在执行的工作步骤','用于审计Agent决策依据']
  },
  'state-snapshot': {
    title:'工业状态帧快照', tag:'INDUSTRIAL STATE FRAME',
    desc:'展示系统自动读取的工业现场状态，替代人工选择工况。',
    bullets:['双目相机帧、点云、AGV坐标','PLC联锁、安全门、急停、气压','CRC完整性校验和状态帧编号','作为多Agent决策的唯一入口']
  },
  'model-output': {
    title:'算法模型输出概览', tag:'ALGORITHM MODEL OUTPUT',
    desc:'展示算法工程师模型输出如何变成Agent审查输入。',
    bullets:['YOLO铜箔识别置信度','SGBM深度估计和RMSE','AGV定位和放置点识别','规划模型与约束模型评分']
  },
  evidence: {
    title:'证据链表 / 决策依据', tag:'EVIDENCE CHAIN',
    desc:'记录每个Agent引用的证据，证明决策不是拍脑袋。',
    bullets:['相机帧、点云帧、目标检测','路径规划、联锁校验、权限矩阵','每条证据带来源、时间和引用Agent','归档时与报告一起固化']
  },
  matrix: {
    title:'动作权限矩阵', tag:'ACTION PERMISSION MATRIX',
    desc:'把最终动作约束为ALLOW、LIMITED、BLOCK或WAIT；无设备连接时全部保持LOCKED。',
    bullets:['没有设备连接时全部LOCKED','硬件联锁异常时限制或阻断','执行约束超限时转为LIMITED','控制任务必须通过矩阵才能生成']
  },
  'control-task': {
    title:'控制任务中心', tag:'CONTROL TASK CENTER',
    desc:'展示最终控制任务JSON和动作下发前的安全参数。',
    bullets:['MOVEJ / MOVEL / PICK动作序列','速度缩放、安全模式和有效期','来源于控制任务生成Agent','未连接设备时只保留预览不允许下发']
  },
  trace: {
    title:'决策Trace / 运行日志', tag:'DECISION TRACE',
    desc:'按时间线记录多Agent链路的每一步。',
    bullets:['记录Agent输入、状态和输出','记录风险、耗时和工具调用','用于异常复盘与责任追溯','可进入报告归档打印']
  },
  archive: {
    title:'Trace与报告归档摘要', tag:'TRACE & ARCHIVE',
    desc:'归档本轮决策的证据、Trace、权限矩阵和任务结果。',
    bullets:['日志打印和浏览器PDF导出','固化设备编号与任务编号','支持成功/降级/人工接管统计','用于运维归档和生产复盘']
  },
  alarm: {
    title:'告警中心', tag:'ALARM CENTER',
    desc:'集中显示工业链路、设备安全和执行约束告警。',
    bullets:['安全门延时确认','J2扭矩逼近上限','AGV通信延迟波动','按高危/中危/低危分类']
  }
};


function agentRoleCardsHtml(){
  return AGENT_ROLE_DETAILS.map((a, idx) => `
    <article class="agent-role-card clickable-agent-card" data-agent-index="${idx}" title="点击查看${escapeHtml(a.name)}的决策依据">
      <div class="agent-role-index">${String(idx + 1).padStart(2,'0')}</div>
      <div class="agent-role-main">
        <div class="agent-role-title"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.layer)}</span></div>
        <p><strong>作用：</strong>${escapeHtml(a.role)}</p>
        <p><strong>输入：</strong>${escapeHtml(a.input)}</p>
        <p><strong>工作：</strong>${escapeHtml(a.work)}</p>
        <p><strong>输出：</strong>${escapeHtml(a.output)}</p>
        <small class="agent-click-hint">点击查看：数据支持 / 决策规则 / 工具调用 / 为什么这样判断</small>
      </div>
      <em class="risk-${String(a.risk).toLowerCase()}">${escapeHtml(a.risk)}</em>
    </article>`).join('');
}

function buildAgentDecisionDetailView(index){
  const agent = AGENT_ROLE_DETAILS[index] || AGENT_ROLE_DETAILS[0];
  const detail = AGENT_DECISION_SUPPORT[agent.name] || {};
  const dataRows = (detail.data || []).map(([k,v]) => `<div class="decision-data-cell"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join('');
  const rules = (detail.rules || []).map(r => `<li>${escapeHtml(r)}</li>`).join('');
  const tools = (detail.tools || []).map(t => `<code>${escapeHtml(t)}</code>`).join('');
  const evidences = (detail.evidence || []).map((ev,i) => `<p><b>${String(i+1).padStart(2,'0')}</b><span>${escapeHtml(ev)}</span></p>`).join('');
  return Object.assign(document.createElement('div'), {className:'agent-decision-detail-view', innerHTML: `
    <section class="agent-detail-hero">
      <button class="back-agent-map" data-action="back-agent-role-map">← 返回Agent分工图谱</button>
      <div class="agent-detail-title-row">
        <div class="agent-role-index large">${String(index + 1).padStart(2,'0')}</div>
        <div><span>${escapeHtml(agent.layer)} / AGENT DECISION DETAIL</span><h3>${escapeHtml(agent.name)}</h3><p>${escapeHtml(agent.role)}</p></div>
        <em class="risk-${String(agent.risk).toLowerCase()}">${escapeHtml(agent.risk)}</em>
      </div>
    </section>
    <section class="agent-decision-layout">
      <article class="agent-decision-card primary">
        <h4>这个Agent做了什么</h4>
        <p>${escapeHtml(agent.work)}</p>
        <div class="agent-process-flow"><span>读取输入</span><i></i><span>规则校验</span><i></i><span>工具调用</span><i></i><span>输出结论</span></div>
      </article>
      <article class="agent-decision-card primary">
        <h4>它通过什么决策</h4>
        <p>${escapeHtml(detail.decision || '-')}</p>
        <h5>为什么这样决策</h5>
        <p>${escapeHtml(detail.why || '-')}</p>
      </article>
      <article class="agent-decision-card wide">
        <h4>数据支持</h4>
        <div class="decision-data-grid">${dataRows}</div>
      </article>
      <article class="agent-decision-card">
        <h4>命中规则</h4>
        <ul class="decision-rule-list">${rules}</ul>
      </article>
      <article class="agent-decision-card">
        <h4>确定性工具调用</h4>
        <div class="decision-tool-list">${tools}</div>
      </article>
      <article class="agent-decision-card wide">
        <h4>证据链</h4>
        <div class="decision-evidence-list">${evidences}</div>
      </article>
      <article class="agent-decision-card final">
        <h4>输出结果</h4>
        <strong>${escapeHtml(detail.output || agent.output)}</strong>
        <p>该结果会写入上游/下游Agent上下文，并进入最终融合仲裁或归档。</p>
      </article>
    </section>`});
}

function openAgentDecisionDetail(index){
  const overlay = $('moduleOverlay');
  const content = $('overlayContent');
  const title = $('overlayTitle');
  if(!overlay || !content || !title) return;
  const agent = AGENT_ROLE_DETAILS[index] || AGENT_ROLE_DETAILS[0];
  title.textContent = `${agent.name} / 决策详情`;
  content.innerHTML = '';
  content.appendChild(buildAgentDecisionDetailView(index));
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');
}

function buildAgentRoleMapView(){
  const wrap = document.createElement('div');
  wrap.className = 'agent-role-map-view';
  wrap.innerHTML = `
    <section class="module-detail-hero">
      <div><span>AGENT ROLE MAP</span><h3>本平台使用的Agent与分工</h3><p>下面展示每个Agent在决策链路中的作用、输入、工作内容和输出结果，方便评委理解“多Agent到底怎么协同”。</p></div>
      <b>12 个Agent / 6 路并行专家审查</b>
    </section>
    <section class="agent-role-grid">${agentRoleCardsHtml()}</section>`;
  return wrap;
}


function readAgentReviewField(id, fallback='-'){
  return document.getElementById(id)?.textContent?.trim() || fallback;
}

function buildAgentReviewLiveView(){
  const works = Array.from(document.querySelectorAll('#agentWork li')).map(li => `<li>${escapeHtml(li.textContent.trim())}</li>`).join('') || '<li>等待Agent进入审理状态</li>';
  const title = readAgentReviewField('agentStatusTag', '当前Agent审理台');
  const wrap = document.createElement('section');
  wrap.className = 'agent-review-live-panel';
  wrap.setAttribute('data-agent-review-live', 'true');
  wrap.innerHTML = `
    <div class="live-agent-head">
      <div>
        <span>AGENT REVIEW LIVE</span>
        <h3 data-live="title">${escapeHtml(title)}</h3>
        <p>本页与首页决策树同步更新，决策进行时和完成后均保持一致；除非主动清理，本轮审理结果会保留。</p>
      </div>
      <div class="live-agent-badges">
        <b>风险 <em data-live="risk">${escapeHtml(readAgentReviewField('agentRisk'))}</em></b>
        <b>耗时 <em data-live="latency">${escapeHtml(readAgentReviewField('agentLatency'))}</em></b>
      </div>
    </div>
    <div class="live-agent-grid">
      <article><label>输入摘要</label><p data-live="input">${escapeHtml(readAgentReviewField('agentInput'))}</p></article>
      <article><label>命中规则</label><p data-live="rule">${escapeHtml(readAgentReviewField('agentRule'))}</p></article>
      <article><label>证据理由</label><p data-live="evidence">${escapeHtml(readAgentReviewField('agentEvidence'))}</p></article>
      <article><label>处理建议</label><p data-live="suggestion">${escapeHtml(readAgentReviewField('agentSuggestion'))}</p></article>
      <article class="wide"><label>工具调用</label><p data-live="tool">${escapeHtml(readAgentReviewField('agentTool'))}</p></article>
      <article class="wide">
        <label>Agent正在执行的工作步骤</label>
        <ul data-live="work">${works}</ul>
      </article>
    </div>`;
  return wrap;
}

function buildStateSnapshotNarrativeView(){
  const wrap = document.createElement('section');
  wrap.className = 'state-snapshot-narrative';
  wrap.innerHTML = `
    <div class="state-summary-head">
      <div><span>STATE FRAME ANALYSIS</span><h3>工业状态帧解读</h3><p>状态帧不仅展示设备画面，还应说明哪些状态会进入多Agent审查，哪些字段会影响最终任务下发。</p></div>
    </div>
    <div class="state-summary-grid">
      <article><h4>采集对象</h4><p>双目视觉、点云深度、PLC联锁、AGV位姿、气压、电源与CRC完整性。</p></article>
      <article><h4>进入决策的关键字段</h4><p>目标置信度、Z轴距离、安全门、急停、气压阈值、控制器心跳。</p></article>
      <article><h4>对Agent的影响</h4><p>视觉质量Agent、三维定位Agent、硬件联锁Agent将直接引用这些字段。</p></article>
      <article><h4>异常策略</h4><p>状态帧字段缺失或CRC不通过时，不生成可下发控制任务。</p></article>
    </div>`;
  return wrap;
}

function buildModuleDetailView(targetId){
  const meta = MODULE_DETAIL_META[targetId] || {title: moduleTitleMap[targetId] || '平台模块', tag:'PLATFORM MODULE', desc:'平台功能模块详情。', bullets:['展示模块核心输入与输出','支持从左侧导航进入','提供审查、控制与归档能力','可与现场设备配置联动']};
  const wrap = document.createElement('div');
  const sideFreeIds = new Set(['agent-review', 'state-snapshot', 'control-task']);
  const noSide = sideFreeIds.has(targetId);
  wrap.className = `module-detail-view${noSide ? ' no-side-route' : ''}`;
  const source = $(targetId);
  const cloned = source ? source.cloneNode(true) : null;
  if(cloned){
    cloned.classList.remove('module-spotlight');
    cloned.classList.add('focused-clone-panel');
  }
  wrap.innerHTML = `
    <section class="module-detail-hero">
      <div><span>${escapeHtml(meta.tag)}</span><h3>${escapeHtml(meta.title)}</h3><p>${escapeHtml(meta.desc)}</p></div>
      <button class="detail-action-btn" data-action="show-agent-role-map">查看Agent分工</button>
    </section>
    <section class="module-detail-layout${noSide ? ' side-free' : ''}">
      <div class="module-detail-primary"></div>
      ${noSide ? '' : `<aside class="module-detail-side">
        ${!isDeviceConnected() ? '<div class="no-device-hint">当前无设备连接：模块仅展示配置/预览，不能启动真实决策链路。</div>' : ''}
        <h4>模块说明</h4>
        <ul>${meta.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
        <div class="module-agent-mini">
          <h4>关联Agent</h4>
          ${relatedAgentsForModule(targetId).map(a => `<p><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.role)}</span></p>`).join('')}
        </div>
      </aside>`}
    </section>`;
  const primary = wrap.querySelector('.module-detail-primary');
  if(targetId === 'tree-panel'){
    const treeClone = cloned || document.createElement('div');
    primary.appendChild(treeClone);
    const map = document.createElement('section');
    map.className = 'agent-role-inline-section';
    map.innerHTML = `<h3>参与Agent与作用说明</h3><div class="agent-role-grid compact">${agentRoleCardsHtml()}</div>`;
    primary.appendChild(map);
  } else if(targetId === 'control-task') {
    primary.appendChild(buildControlTaskFocusView());
    const lifecycle = document.createElement('section');
    lifecycle.className = 'control-lifecycle-card';
    lifecycle.innerHTML = `<h3>控制任务生成链路</h3><div class="control-lifecycle"><span>融合仲裁</span><i></i><span>权限矩阵</span><i></i><span>轨迹生成</span><i></i><span>设备握手</span><i></i><span>等待下发</span></div><p>控制任务只有在设备接入、仲裁完成、权限校验通过后才允许进入下发阶段。</p></section>`;
    primary.appendChild(lifecycle);
  } else if(targetId === 'archive') {
    primary.appendChild(buildArchiveFocusView());
  } else if(targetId === 'agent-review') {
    primary.appendChild(buildAgentReviewLiveView());
    const agentExplain = document.createElement('section');
    agentExplain.className = 'agent-explain-panel refined';
    agentExplain.innerHTML = `<h3>审理链路说明</h3><p>当前审理页会和决策树共用同一份状态：正在执行的Agent、处理建议、证据理由与日志将保持同步；任务完成后持续保留，直到人工清理。</p><div class="agent-role-grid compact">${agentRoleCardsHtml()}</div>`;
    primary.appendChild(agentExplain);
    setTimeout(() => syncAgentReviewMirror?.(), 0);
  } else if(targetId === 'state-snapshot') {
    if(cloned) primary.appendChild(cloned);
    primary.appendChild(buildStateSnapshotNarrativeView());
  } else {
    if(cloned) primary.appendChild(cloned);
    else primary.innerHTML = `<section class="virtual-module"><h3>${escapeHtml(meta.title)}</h3><p>${escapeHtml(meta.desc)}</p></section>`;
  }
  return wrap;
}

function relatedAgentsForModule(targetId){
  const pick = names => AGENT_ROLE_DETAILS.filter(a => names.some(n => a.name.includes(n)));
  const map = {
    'tree-panel': AGENT_ROLE_DETAILS,
    'agent-review': AGENT_ROLE_DETAILS.slice(0,6),
    'state-snapshot': pick(['状态帧','算法输出']),
    'model-output': pick(['算法输出','视觉质量','三维定位','放置规划']),
    evidence: pick(['状态帧','视觉质量','三维定位','放置规划','报告归档']),
    matrix: pick(['硬件联锁','安全策略','执行约束','控制任务']),
    'control-task': pick(['融合仲裁','控制任务','硬件联锁','执行约束']),
    trace: pick(['状态帧','融合仲裁','控制任务','报告归档']),
    archive: pick(['报告归档','融合仲裁','控制任务']),
    alarm: pick(['硬件联锁','执行约束','安全策略'])
  };
  return map[targetId] || AGENT_ROLE_DETAILS.slice(0,4);
}

function openModuleOverlay(targetId, title){
  const overlay = $('moduleOverlay');
  const content = $('overlayContent');
  const overlayTitle = $('overlayTitle');
  if(!overlay || !content || !overlayTitle) return;
  overlayTitle.textContent = title || moduleTitleMap[targetId] || targetId;
  content.innerHTML = '';
  if(targetId === 'config') {
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
    dash.innerHTML = `<section class="module-detail-hero"><div><span>WORKBENCH OVERVIEW</span><h3>决策工作台总览</h3><p>首页每个板块都可以点击放大查看，决策树、审理台、状态帧、模型输出、证据链、权限矩阵、Trace、归档都已接入模块详情。</p></div><button class="detail-action-btn" data-action="show-agent-role-map">查看Agent分工</button></section><section class="workbench-module-map"></section>`;
    const grid = dash.querySelector('.workbench-module-map');
    ['tree-panel','agent-review','state-snapshot','model-output','evidence','matrix','control-task','trace','archive','alarm'].forEach(id => {
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

async function loadMeta(){
  try{
    const res = await fetch('/api/meta');
    const data = await res.json();
    $('frameId').textContent = data.frame_id;
    $('decisionId').textContent = data.decision_id;
    $('currentTask').textContent = isDeviceConnected() ? data.current_task : '无设备连接';
    $('runtimeTop').textContent = data.runtime;
  }catch(e){ console.warn('meta load failed', e); }
  updateRunGate();
}

function enhanceHomepageModules(){
  document.querySelectorAll('main .panel[id]').forEach(panel => {
    panel.classList.add('clickable-panel');
    if(!panel.querySelector('.click-tip')){
      const tip = document.createElement('button');
      tip.type = 'button';
      tip.className = 'click-tip';
      tip.dataset.moduleTarget = panel.id;
      tip.textContent = '点击放大';
      panel.appendChild(tip);
    }
  });
  const treeHead = document.querySelector('#tree-panel .panel-head');
  if(treeHead && !treeHead.querySelector('.agent-map-trigger')){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'agent-map-trigger';
    btn.dataset.moduleTarget = 'agent-role-map';
    btn.innerHTML = '参与Agent：<b>12</b> 个 · 查看作用';
    treeHead.appendChild(btn);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  enhanceHomepageModules();
  document.addEventListener('click', (e) => {
    const direct = e.target.closest('[data-module-target]');
    if(direct){
      e.preventDefault();
      e.stopPropagation();
      const id = direct.dataset.moduleTarget;
      openModuleOverlay(id, moduleTitleMap[id] || direct.textContent.trim());
      return;
    }
    const panel = e.target.closest('main .panel[id]');
    if(!panel) return;
    if(e.target.closest('button,a,input,select,textarea,pre,[data-action],.tree-node,.tree-viewport,.flow-builder-toolbar,.flow-agent-library,[data-no-overlay]')) return;
    openModuleOverlay(panel.id, moduleTitleMap[panel.id] || panel.id);
  }, true);
  document.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if(action === 'show-agent-role-map'){
      e.preventDefault();
      openModuleOverlay('agent-role-map', 'Agent分工与作用图谱');
    }
    if(action === 'back-agent-role-map'){
      e.preventDefault();
      openModuleOverlay('agent-role-map', 'Agent分工与作用图谱');
    }
    if(action === 'disconnect-device'){
      e.preventDefault();
      clearStoredDevice();
      updateRunGate();
      const content = $('overlayContent');
      if(content){ content.innerHTML=''; content.appendChild(buildDeviceConfigView()); bindDeviceConfigView(content); }
    }
  });
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.agent-role-card[data-agent-index]');
    if(!card) return;
    e.preventDefault();
    e.stopPropagation();
    openAgentDecisionDetail(Number(card.dataset.agentIndex));
  }, true);
});


