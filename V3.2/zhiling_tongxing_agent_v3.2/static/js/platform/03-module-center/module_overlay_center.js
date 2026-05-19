function openModuleOverlay(targetId, title){
  const overlay = $('moduleOverlay');
  const content = $('overlayContent');
  const overlayTitle = $('overlayTitle');
  if(!overlay || !content || !overlayTitle) return;
  overlayTitle.textContent = title || moduleTitleMap[targetId] || targetId;
  content.innerHTML = '';
  if(targetId === 'config') {
    content.appendChild(buildConfigCenterView());
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    return;
  }
  if(targetId === 'device-config') {
    content.appendChild(buildDeviceConfigView());
    bindDeviceConfigView(content);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    return;
  }
  if(targetId === 'control-task') {
    content.appendChild(buildControlTaskFocusView());
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    return;
  }
  if(targetId === 'archive') {
    content.appendChild(buildArchiveFocusView());
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    return;
  }
  const target = $(targetId);
  if(target && targetId !== 'workbench') {
    const clone = target.cloneNode(true);
    clone.classList.remove('module-spotlight');
    content.appendChild(clone);
  } else if(targetId === 'workbench') {
    const wrap = document.createElement('div');
    wrap.className = 'detail-grid';
    ['tree-panel','agent-review','evidence','matrix'].forEach(id => {
      const el = $(id);
      if(el) wrap.appendChild(el.cloneNode(true));
    });
    content.appendChild(wrap);
  } else {
    content.innerHTML = `<div class="virtual-module"><div><h3>${title || moduleTitleMap[targetId] || '平台模块'}</h3><p>该模块已预留为工业智能体平台能力入口。</p><p>后续可接入真实设备参数、模型管理、权限配置和生产任务队列。</p><div class="fake-grid"><span>设备参数</span><span>Agent策略</span><span>系统日志</span></div></div></div>`;
  }
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');
}

function focusModuleFromNav(targetId, title){
  const target = $(targetId);
  document.querySelectorAll('.nav-item,.nav-subitem').forEach(item => item.classList.toggle('active', item.getAttribute('href') === '#' + targetId));
  if(target){
    target.scrollIntoView({behavior:'smooth', block:'center', inline:'nearest'});
    target.classList.remove('module-spotlight');
    void target.offsetWidth;
    target.classList.add('module-spotlight');
    setTimeout(() => target.classList.remove('module-spotlight'), 2600);
  }
  openModuleOverlay(targetId, title);
}


function buildConfigCenterView(){
  const saved = getStoredDevice();
  const connected = Boolean(saved && saved.connected);
  const wrap = document.createElement('div');
  wrap.className = 'config-center-page';
  wrap.innerHTML = `
    <section class="config-hero">
      <div><span>SYSTEM CONFIG CENTER</span><h3>系统配置中心</h3><p>设备、Agent策略、权限、日志、状态源和控制接口统一配置入口。</p></div>
      <b class="${connected ? 'ok' : 'warn'}">${connected ? '设备001已连接' : '无设备连接'}</b>
    </section>
    <section class="config-grid">
      <button class="config-tile primary" data-action="open-device-config">
        <em>▣</em><h4>设备参数</h4><p>填写机械臂、PLC、相机、AGV 等硬件链路信息；未连接设备时禁止启动多Agent决策。</p><span>${connected ? '已连接 / DEVICE-001' : '无设备连接 / 点击配置'}</span>
      </button>
      <button class="config-tile" data-action="open-config-detail" data-config="agent-policy">
        <em>⌘</em><h4>Agent策略参数</h4><p>专家Agent阈值、投票权重、并行审查节奏、降级策略和安全仲裁优先级。</p><span>阈值0.70 / 延迟2.35s</span>
      </button>
      <button class="config-tile" data-action="open-config-detail" data-config="permission-template">
        <em>▦</em><h4>动作权限模板</h4><p>INIT_ARM、PICK_PLACE、STOP_EMG、RECHECK_VISION 的允许、受限、阻断条件。</p><span>4类动作 / 12条规则</span>
      </button>
      <button class="config-tile" data-action="open-config-detail" data-config="log-archive">
        <em>☷</em><h4>日志与归档</h4><p>Trace保留周期、归档字段、PDF打印模板、审计链路和运行日志级别。</p><span>Trace 30天 / PDF可导出</span>
      </button>
      <button class="config-tile" data-action="open-config-detail" data-config="state-source">
        <em>◇</em><h4>工业状态源</h4><p>相机帧、点云、PLC、气压、安全门、AGV 坐标和CRC字段统一映射。</p><span>6类状态源 / 待设备同步</span>
      </button>
      <button class="config-tile" data-action="open-config-detail" data-config="control-interface">
        <em>✜</em><h4>控制接口</h4><p>机械臂SDK、Modbus TCP、ROS2 Bridge、TCP Socket 与心跳控制层配置。</p><span>${connected ? (saved.protocol || '协议已配置') : '无设备连接'}</span>
      </button>
    </section>`;
  setTimeout(refreshRuntimeDocsPanel, 80);
  return wrap;
}

function buildConfigDetailView(type){
  const saved = getStoredDevice();
  const connected = Boolean(saved && saved.connected);
  const configs = {
    'agent-policy': {
      title: 'Agent策略参数', tag: 'AGENT POLICY', desc: '用于控制多Agent并行审查、仲裁投票和风险降级的核心策略。',
      rows: [
        ['并行审查延迟', '2.35s / Step', '让审查节奏接近真实工业Agent判断，不瞬间出结果'],
        ['仲裁共识阈值', '70%', '达到阈值后进入安全策略仲裁，否则触发复核'],
        ['安全策略权重', '0.35', '安全相关Agent拥有最高仲裁权重'],
        ['硬件联锁权重', '0.25', '联锁异常时优先降级或阻断动作'],
        ['执行约束权重', '0.20', '用于限制速度、扭矩和路径可达性'],
        ['视觉/定位权重', '0.20', '负责目标识别、深度和坐标可信度']
      ],
      chips: ['VoteFusion', 'SafetyVeto', 'RiskDowngrade', 'ParallelReview']
    },
    'permission-template': {
      title: '动作权限模板', tag: 'ACTION POLICY', desc: '定义控制动作是否允许下发，避免Agent绕过工业安全边界。',
      rows: [
        ['INIT_ARM', 'ALLOW', 'CRC通过、急停释放、控制器在线'],
        ['PICK_PLACE', 'LIMITED', '允许抓放，但安全门延时或扭矩接近上限时限速30%'],
        ['STOP_EMG', 'BLOCK', '安全门打开、急停触发、通信中断时强制停止'],
        ['RECHECK_VISION', 'ALLOW', '视觉置信度低于0.85或遮挡时触发复检'],
        ['RECHECK_DEPTH', 'ALLOW', 'SGBM深度波动超过阈值时重新测距'],
        ['READY_TO_DISPATCH', 'WAIT', '等待融合仲裁通过后进入可派发状态']
      ],
      chips: ['ALLOW', 'LIMITED', 'BLOCK', 'WAIT']
    },
    'log-archive': {
      title: '日志与归档', tag: 'LOG ARCHIVE', desc: '记录多Agent决策过程、证据链、控制任务和归档报告。',
      rows: [
        ['Trace保留周期', '30天', '保留Agent输入、证据、状态、风险和耗时'],
        ['归档报告格式', 'HTML / PDF', '浏览器打印可另存为PDF'],
        ['审计字段', '15项', '帧ID、决策ID、设备ID、Agent链路、权限矩阵等'],
        ['日志等级', 'INFO / WARN / RISK', '告警中心按等级聚合展示'],
        ['报告编号规则', 'REP-年月日-序号', '用于比赛展示和后续复盘'],
        ['异常复盘', '开启', '记录阻断、受限、人工接管原因']
      ],
      chips: ['Trace', 'PDF', 'Archive', 'Audit']
    },
    'state-source': {
      title: '工业状态源', tag: 'STATE FRAME SOURCE', desc: '将现场传感器和算法输出统一封装为Agent可读状态帧。',
      rows: [
        ['CameraBus', connected ? 'ONLINE' : 'WAIT_DEVICE', '双目相机帧、图像修复、YOLO目标框'],
        ['PointCloud', connected ? 'SYNCED' : 'WAIT_DEVICE', 'SGBM深度图、点云编号、Z轴距离'],
        ['PLCBus', connected ? 'ONLINE' : 'WAIT_DEVICE', '安全门、急停、气压、电源、联锁I/O'],
        ['AGVLink', connected ? 'ONLINE' : 'WAIT_DEVICE', 'AGV定位、目标放置点、车体姿态'],
        ['CRC Monitor', connected ? 'HEALTHY' : 'WAIT_DEVICE', '状态帧完整性和通信校验'],
        ['Frame Builder', connected ? 'READY' : 'LOCKED', '无设备连接时不生成真实决策状态帧']
      ],
      chips: ['Camera', 'PLC', 'AGV', 'CRC']
    },
    'control-interface': {
      title: '控制接口', tag: 'CONTROL INTERFACE', desc: '连接真实机械臂控制层；无设备连接时控制任务只保留预览，不允许下发。',
      rows: [
        ['设备编号', connected ? 'DEVICE-001' : '无设备连接', connected ? '已接入设备参数' : '请先配置设备参数'],
        ['通信协议', connected ? (saved.protocol || '-') : '未配置', 'Modbus TCP / EtherCAT / TCP Socket / ROS2 Bridge'],
        ['设备地址', connected ? `${saved.ip || '-'}:${saved.port || '-'}` : '未配置', '用于工业链路握手与心跳检测'],
        ['控制器编号', connected ? (saved.controller || '-') : '未配置', 'PLC或机械臂控制器编号'],
        ['心跳周期', '100ms', '断联超过3次会阻断PICK_PLACE'],
        ['指令下发', connected ? 'READY' : 'LOCKED', '未连接设备时禁止启动决策和控制任务下发']
      ],
      chips: ['SDK', 'Modbus', 'ROS2', 'Socket']
    }
  };
  const cfg = configs[type] || configs['agent-policy'];
  const wrap = document.createElement('div');
  wrap.className = 'config-detail-page';
  wrap.innerHTML = `
    <section class="config-detail-card">
      <div class="config-detail-head"><div><span>${cfg.tag}</span><h3>${cfg.title}</h3><p>${cfg.desc}</p></div><button data-action="back-config-center">返回系统配置</button></div>
      <div class="config-detail-table">
        ${cfg.rows.map(([k,v,d]) => `<div class="config-detail-row"><b>${escapeHtml(k)}</b><strong>${escapeHtml(v)}</strong><p>${escapeHtml(d)}</p></div>`).join('')}
      </div>
      <div class="config-chip-row">${cfg.chips.map(c => `<span>${escapeHtml(c)}</span>`).join('')}</div>
    </section>`;
  setTimeout(refreshRuntimeDocsPanel, 80);
  return wrap;
}

function buildControlTaskFocusView(){
  const wrap = document.createElement('div');
  wrap.className = 'control-focus-view';
  const connected = isDeviceConnected();
  const code = $('taskJson')?.textContent || '{}';
  const actionType = connected ? 'PICK_AND_PLACE' : 'WAIT_DEVICE';
  const mode = connected ? 'LIMITED' : 'LOCKED';
  const dispatch = connected ? '等待设备确认' : '无设备连接，禁止启动决策和指令下发';
  wrap.innerHTML = `<section class="panel control-focus-panel"><div class="panel-head compact"><h3>控制任务中心 / 指令预览</h3><span>放大代码视图</span></div><pre class="large-task-code">${escapeHtml(code)}</pre><div class="control-note-grid"><p><b>动作类型</b><span>${actionType}</span></p><p><b>安全模式</b><span>${mode}</span></p><p><b>来源Agent</b><span>控制任务生成Agent</span></p><p><b>下发状态</b><span>${dispatch}</span></p></div></section>`;
  return wrap;
}

function buildArchiveFocusView(){
  const wrap = document.createElement('div');
  wrap.className = 'archive-focus-view';
  wrap.innerHTML = `<section class="panel archive-focus-panel"><div class="panel-head compact"><h3>报告归档 / 日志打印</h3><span>Archive</span></div><div class="archive-focus-actions"><button data-action="show-report-log">显示归档日志</button><button data-action="print-archive-pdf">打印 / 另存为PDF</button></div><div class="archive-report-preview">${buildArchiveReportHtml()}</div></section>`;
  return wrap;
}

function buildArchiveReportHtml(){
  const device = getStoredDevice();
  const now = new Date().toLocaleString('zh-CN', {hour12:false});
  return `<div class="report-sheet">
    <h1>智领铜行--人工智能机械臂多Agent智能决策平台</h1>
    <h2>任务归档日志 / REP-20260509-00187</h2>
    <table><tbody>
      <tr><th>打印时间</th><td>${escapeHtml(now)}</td><th>任务类型</th><td>PICK_AND_PLACE</td></tr>
      <tr><th>帧ID</th><td>FRM-20260509-001245</td><th>决策ID</th><td>DEC-20260509-00187</td></tr>
      <tr><th>设备编号</th><td>${device && device.connected ? 'DEVICE-001 / 已连接' : '未接入硬件设备'}</td><th>风险等级</th><td>MEDIUM</td></tr>
      <tr><th>执行结果</th><td>降级执行</td><th>安全模式</th><td>LIMITED</td></tr>
    </tbody></table>
    <h3>多Agent审理日志</h3>
    <ol class="report-log-list">
      <li>状态帧采集Agent：采集双目相机、AGV视觉、PLC联锁状态帧，CRC校验通过。</li>
      <li>任务上下文建模Agent：识别铜箔抓取工况，拆解看、识、抓、放任务链。</li>
      <li>视觉质量Agent：YOLO铜箔识别置信度0.98，视觉质量 PASS。</li>
      <li>三维定位Agent：SGBM深度估计RMSE 0.21mm，定位精度 PASS。</li>
      <li>放置规划Agent：生成第3候选路径，路径可行率92%，状态 PASS。</li>
      <li>硬件联锁Agent：安全门存在延时确认，触发 LIMITED 降级策略。</li>
      <li>安全策略Agent：风险可控，允许受限模式下执行。</li>
      <li>执行约束Agent：J2扭矩接近上限，建议限速30%。</li>
      <li>融合仲裁Agent：3 PASS / 1 LIMITED / 1 BLOCKED，经权重投票进入受限执行。</li>
      <li>控制任务生成Agent：生成 PICK_AND_PLACE 控制任务，speed_scale=0.7。</li>
      <li>报告归档Agent：固化证据链15条、工具调用7项、Trace日志12条。</li>
    </ol>
    <h3>归档结论</h3><p>本次任务允许在 LIMITED 安全模式下执行；建议后续复核安全门延时与J2扭矩阈值。</p>
  </div>`;
}

function showArchiveReport(){
  const modal = $('reportPrintModal');
  const body = $('printableArchiveReport');
  if(!modal || !body) return;
  body.innerHTML = buildArchiveReportHtml();
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
}

function closeArchiveReport(){
  const modal = $('reportPrintModal');
  modal?.classList.remove('open');
  modal?.setAttribute('aria-hidden','true');
}

function printArchiveReport(){
  const body = $('printableArchiveReport');
  if(body && !body.innerHTML.trim()) body.innerHTML = buildArchiveReportHtml();
  showArchiveReport();
  setTimeout(() => window.print(), 250);
}

function buildDeviceConfigView(){
  const saved = getStoredDevice();
  const d = saved || {};
  const wrap = document.createElement('div');
  wrap.className = 'device-config-page';
  wrap.innerHTML = `
    <section class="device-card">
      <div class="device-card-head">
        <div><span>HARDWARE CONFIG</span><h3>硬件设备信息填入</h3></div>
        <div class="device-badge">设备参数接入</div>
      </div>
      <form id="deviceForm" class="device-form" autocomplete="off">
        <div class="device-field"><label>设备名称</label><input name="deviceName" value="${escapeHtml(d.deviceName)}" placeholder="请输入设备名称，例如：六轴协作机械臂" required></div>
        <div class="device-field"><label>设备类型</label><select name="deviceType"><option value="">请选择设备类型</option><option${selectedOption('工业机械臂', d.deviceType)}>工业机械臂</option><option${selectedOption('AGV小车', d.deviceType)}>AGV小车</option><option${selectedOption('双目相机', d.deviceType)}>双目相机</option><option${selectedOption('PLC控制器', d.deviceType)}>PLC控制器</option><option${selectedOption('末端夹具', d.deviceType)}>末端夹具</option></select></div>
        <div class="device-field"><label>设备品牌 / 型号</label><input name="model" value="${escapeHtml(d.model)}" placeholder="请输入设备型号，例如：ARM-C6-1450"></div>
        <div class="device-field"><label>通信协议</label><select name="protocol"><option value="">请选择通信协议</option><option${selectedOption('Modbus TCP', d.protocol)}>Modbus TCP</option><option${selectedOption('EtherCAT', d.protocol)}>EtherCAT</option><option${selectedOption('OPC UA', d.protocol)}>OPC UA</option><option${selectedOption('TCP Socket', d.protocol)}>TCP Socket</option><option${selectedOption('ROS2 Bridge', d.protocol)}>ROS2 Bridge</option></select></div>
        <div class="device-field"><label>设备 IP</label><input name="ip" value="${escapeHtml(d.ip)}" placeholder="请输入设备IP，例如：192.168.1.88"></div>
        <div class="device-field"><label>端口</label><input name="port" value="${escapeHtml(d.port)}" placeholder="请输入端口，例如：502"></div>
        <div class="device-field"><label>控制器编号</label><input name="controller" value="${escapeHtml(d.controller)}" placeholder="请输入控制器编号，例如：PLC-A03"></div>
        <div class="device-field"><label>最大负载 / 速度</label><input name="payload" value="${escapeHtml(d.payload)}" placeholder="请输入最大负载 / 速度，例如：5kg / 0.7m/s"></div>
        <div class="device-field full"><label>设备说明</label><textarea name="remark" placeholder="填写设备用途、安装位置、联锁说明">${escapeHtml(d.remark)}</textarea></div>
        <div class="device-actions"><button type="button" id="deviceReset" class="device-reset">清空并断开</button><button type="submit" class="device-confirm">确认并连接设备</button></div>
      </form>
    </section>
    <section class="device-card">
      <div class="device-card-head">
        <div><span>DEVICE LINK STATE</span><h3>设备连接状态</h3></div>
        <div id="deviceConnectState" class="device-badge">未连接</div>
      </div>
      <div id="deviceResult" class="device-empty">
        <div><h4>无设备连接</h4><p>当前平台没有接入硬件设备，请先手动填写设备信息并确认连接。</p><p>连接成功后才会生成 <b>DEVICE-001</b>，主页才允许启动多Agent决策。</p></div>
      </div>
    </section>`;
  if(saved && saved.connected) renderConnectedDevice(saved, wrap);
  return wrap;
}

function collectDeviceForm(form){
  const fd = new FormData(form);
  return Object.fromEntries(fd.entries());
}

function showDeviceConnectModal(phase){
  const modal = $('deviceConnectModal');
  const spinner = $('connectSpinner');
  const title = $('connectTitle');
  const message = $('connectMessage');
  const progress = $('connectProgress');
  if(!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  spinner?.classList.remove('success');
  if(progress) progress.style.width = '0%';
  if(title) title.textContent = '设备连接中';
  if(message) message.textContent = '正在建立工业设备链路，校验IP、端口、协议和控制器握手...';
  setTimeout(() => { if(progress) progress.style.width = '100%'; }, 40);
}

function finishDeviceConnectModal(){
  const spinner = $('connectSpinner');
  const title = $('connectTitle');
  const message = $('connectMessage');
  spinner?.classList.add('success');
  if(title) title.textContent = '连接成功';
  if(message) message.textContent = '设备001已接入平台，联锁状态同步完成。';
  setTimeout(() => {
    const modal = $('deviceConnectModal');
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden','true');
  }, 950);
}

function renderDeviceEmpty(root=document){
  const state = root.querySelector('#deviceConnectState');
  const result = root.querySelector('#deviceResult');
  if(state){ state.textContent = '未连接'; state.style.color = ''; }
  if(!result) return;
  result.className = 'device-empty';
  result.innerHTML = `<div><h4>无设备连接</h4><p>当前平台没有接入硬件设备，请先手动填写设备信息并确认连接。</p><p>连接成功后才会生成 <b>DEVICE-001</b>，主页才允许启动多Agent决策。</p></div>`;
}

function renderConnectedDevice(data, root=document){
  const state = root.querySelector('#deviceConnectState');
  const result = root.querySelector('#deviceResult');
  if(state){ state.textContent = '已连接'; state.style.color = '#41f17a'; }
  if(!result) return;
  result.className = 'device-result';
  const connectedTime = data.connectedAt ? new Date(data.connectedAt).toLocaleString('zh-CN', {hour12:false}) : '-';
  result.innerHTML = `
    <div class="device-status-top"><div><span class="device-id">DEVICE-ID：001</span><h3>${escapeHtml(data.deviceName || '工业设备')}</h3></div><b>已连接</b></div>
    <div class="device-param-grid">
      <div class="device-param"><span>设备类型</span><b>${escapeHtml(data.deviceType || '-')}</b></div>
      <div class="device-param"><span>品牌 / 型号</span><b>${escapeHtml(data.model || '-')}</b></div>
      <div class="device-param"><span>通信协议</span><b>${escapeHtml(data.protocol || '-')}</b></div>
      <div class="device-param"><span>IP / 端口</span><b>${escapeHtml(data.ip || '-')}:${escapeHtml(data.port || '-')}</b></div>
      <div class="device-param"><span>控制器编号</span><b>${escapeHtml(data.controller || '-')}</b></div>
      <div class="device-param"><span>负载 / 速度</span><b>${escapeHtml(data.payload || '-')}</b></div>
      <div class="device-param"><span>设备标号</span><b>001</b></div>
      <div class="device-param"><span>接入时间</span><b>${escapeHtml(connectedTime)}</b></div>
    </div>
    <div class="device-link-state">
      <p><span>链路状态</span><b>ONLINE</b></p>
      <p><span>握手校验</span><b>PASS</b></p>
      <p><span>联锁同步</span><b>SYNCED</b></p>
      <p><span>Agent可调用</span><b>READY</b></p>
      <p><span>设备状态</span><b>已连接</b></p>
      <p><span>设备说明</span><b>${escapeHtml(data.remark || '-')}</b></p>
    </div>
    <div class="device-connected-actions">
      <button type="button" class="device-disconnect" data-action="disconnect-device">断开并删除设备001</button>
      <span>删除后主页会回到“无设备连接”，并锁定多Agent决策启动。</span>
    </div>`;
}

function bindDeviceConfigView(root){
  const form = root.querySelector('#deviceForm');
  const reset = root.querySelector('#deviceReset');
  reset?.addEventListener('click', () => {
    clearStoredDevice();
    form.reset();
    form.querySelectorAll('input,textarea').forEach(el => el.value = '');
    form.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
    renderDeviceEmpty(root);
    appendLog('设备参数已清空，DEVICE-001连接状态已断开。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    updateRunGate();
  });
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = collectDeviceForm(form);
    showDeviceConnectModal();
    const state = root.querySelector('#deviceConnectState');
    if(state){ state.textContent = '连接中'; state.style.color = '#18e7ff'; }
    setTimeout(() => {
      const saved = saveStoredDevice(data);
      finishDeviceConnectModal();
      renderConnectedDevice(saved, root);
      appendLog(`设备参数接入成功：DEVICE-001 / ${saved.deviceName || '工业设备'} / ${saved.ip || '-'}:${saved.port || '-'}`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
      updateRunGate();
    }, 3000);
  });
}

