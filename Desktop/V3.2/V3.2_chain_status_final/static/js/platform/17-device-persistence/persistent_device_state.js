/*
 * V3.2 设备持久化稳定版
 * 目标：
 * 1. 首次进入平台保持“未连接设备”；
 * 2. 设备只能由用户在系统配置中手动填写并确认连接；
 * 3. 刷新、切换页面后继续保留已连接设备信息；
 * 4. 仅在用户主动“清空并断开 / 断开并删除”时移除设备。
 */
const ZLTX_DEVICE_KEY = 'zltx_device_config_v32_manual_persist';
const ZLTX_DEVICE_LEGACY_KEYS = [
  'zltx_device_config_stable',
  'zhiling_tongxing_device_config_active',
  'zltx_device_config_default_manual',
  'zltx_device_config_primary'
];

function zltxBlankDevice(){
  return {
    deviceName: '',
    deviceType: '',
    model: '',
    protocol: '',
    ip: '',
    port: '',
    controller: '',
    payload: '',
    remark: '',
    deviceId: '',
    connected: false
  };
}
function zltxNormalizeDevice(data = {}){
  const src = data && typeof data === 'object' ? data : {};
  const connected = src.connected === true;
  return {
    ...zltxBlankDevice(),
    ...src,
    deviceId: connected ? (src.deviceId || '001') : '',
    connected,
    connectedAt: connected ? (src.connectedAt || new Date().toISOString()) : '',
    lastConfirmedAt: connected ? (src.lastConfirmedAt || new Date().toISOString()) : ''
  };
}
function getStoredDevice(){
  try{
    const raw = localStorage.getItem(ZLTX_DEVICE_KEY);
    if(!raw) return null;
    const data = zltxNormalizeDevice(JSON.parse(raw));
    return data.connected ? data : null;
  }catch(err){
    console.warn('设备状态读取失败', err);
    return null;
  }
}
function saveStoredDevice(data){
  const existed = getStoredDevice();
  const payload = zltxNormalizeDevice({
    ...(data || {}),
    deviceId: '001',
    connected: true,
    connectedAt: existed?.connectedAt || new Date().toISOString(),
    lastConfirmedAt: new Date().toISOString()
  });
  localStorage.setItem(ZLTX_DEVICE_KEY, JSON.stringify(payload));
  // 主动清除旧包可能遗留的伪连接缓存，防止刷新后被旧状态污染。
  ZLTX_DEVICE_LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
  return payload;
}
function clearStoredDevice(){
  localStorage.removeItem(ZLTX_DEVICE_KEY);
  ZLTX_DEVICE_LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
}
function isDeviceConnected(){
  return Boolean(getStoredDevice()?.connected);
}
function zltxSelect(name, value, items, placeholder){
  const options = [`<option value="">${escapeHtml(placeholder || '请选择')}</option>`]
    .concat(items.map(item => `<option value="${escapeHtml(item)}"${item === value ? ' selected' : ''}>${escapeHtml(item)}</option>`));
  return `<select name="${name}">${options.join('')}</select>`;
}
function buildDeviceConfigView(){
  const saved = getStoredDevice();
  const d = saved || zltxBlankDevice();
  const wrap = document.createElement('div');
  wrap.className = 'device-config-page';
  wrap.innerHTML = `
    <section class="device-card">
      <div class="device-card-head">
        <div><span>HARDWARE CONFIG</span><h3>设备接入配置</h3></div>
        <div class="device-badge">${saved ? '参数已保存' : '待人工配置'}</div>
      </div>
      <form id="deviceForm" class="device-form" autocomplete="off">
        <div class="device-field"><label>设备名称</label>${zltxSelect('deviceName', d.deviceName, ['工业机械臂主站','AGV协同车','双目视觉单元','PLC联锁控制站'], '请选择设备名称')}</div>
        <div class="device-field"><label>设备类型</label>${zltxSelect('deviceType', d.deviceType, ['工业机械臂','AGV小车','双目相机','PLC控制器','末端夹具'], '请选择设备类型')}</div>
        <div class="device-field"><label>设备品牌 / 型号</label><input name="model" value="${escapeHtml(d.model || '')}" placeholder="例如：ZLTX-R6-1450"></div>
        <div class="device-field"><label>通信协议</label>${zltxSelect('protocol', d.protocol, ['TCP Socket','Modbus TCP','EtherCAT','OPC UA','ROS2 Bridge'], '请选择通信协议')}</div>
        <div class="device-field"><label>设备 IP</label><input name="ip" value="${escapeHtml(d.ip || '')}" placeholder="例如：192.168.1.109"></div>
        <div class="device-field"><label>端口</label><input name="port" value="${escapeHtml(d.port || '')}" placeholder="例如：9000"></div>
        <div class="device-field"><label>控制器编号</label><input name="controller" value="${escapeHtml(d.controller || '')}" placeholder="例如：PLC-A03"></div>
        <div class="device-field"><label>负载 / 速度</label><input name="payload" value="${escapeHtml(d.payload || '')}" placeholder="例如：5kg / 0.7m/s"></div>
        <div class="device-field full"><label>设备说明</label><textarea name="remark" placeholder="填写工位、联锁和用途说明">${escapeHtml(d.remark || '')}</textarea></div>
        <div class="device-actions"><button type="button" id="deviceReset" class="device-reset">清空并断开</button><button type="submit" class="device-confirm">确认并连接设备</button></div>
      </form>
    </section>
    <section class="device-card">
      <div class="device-card-head">
        <div><span>DEVICE LINK STATE</span><h3>设备连接状态</h3></div>
        <div id="deviceConnectState" class="device-badge">${saved ? '已连接' : '未连接'}</div>
      </div>
      <div id="deviceResult" class="${saved ? 'device-result' : 'device-empty'}"></div>
    </section>`;
  if(saved) renderConnectedDevice(saved, wrap);
  else renderDeviceEmpty(wrap);
  return wrap;
}
function zltxUpdateNoDeviceUI(){
  applyDeviceConnectionVisuals?.(false);
  const task = $('currentTask');
  if(task) task.textContent = '无设备连接';
  const bus = $('agentBus');
  if(bus && !window.running){
    bus.dataset.state = 'NO_DEVICE';
    bus.textContent = typeof localizedStatusText === 'function' ? localizedStatusText('NO_DEVICE') : '未连接';
  }
  const focus = $('focusLabel');
  if(focus && !window.running && !String(focus.textContent || '').trim()) focus.textContent = '无设备连接';
  const btn = $('startBtn');
  if(btn && !window.running && !btn.dataset.completed){
    btn.classList.add('gated');
    btn.innerHTML = '<span>⚠</span>暂无设备连接';
    btn.title = '暂无设备连接，请先进入系统配置完成设备接入';
  }
  updateRunGate?.();
  setDispatchButtonState?.();
  setIndustrialStateFrameMedia?.(false);
}
function zltxRestoreDeviceState(){
  const device = getStoredDevice();
  if(!device){
    zltxUpdateNoDeviceUI();
    return null;
  }
  applyDeviceConnectionVisuals?.(true);
  const task = $('currentTask');
  if(task) task.textContent = 'PICK_AND_PLACE';
  const bus = $('agentBus');
  if(bus && !window.running){
    const raw = bus.dataset.state || String(bus.textContent || '').trim();
    if(!/DONE|RUNNING|完成|运行中/u.test(raw)){
      bus.dataset.state = 'STANDBY';
      bus.textContent = typeof localizedStatusText === 'function' ? localizedStatusText('STANDBY') : '待机';
    }
  }
  const focus = $('focusLabel');
  if(focus && /无设备|等待状态帧/u.test(String(focus.textContent || ''))) focus.textContent = '设备状态已确认';
  const btn = $('startBtn');
  if(btn){
    btn.classList.remove('gated');
    if(!btn.dataset.completed && !window.running) btn.innerHTML = '<span>▶</span>采集工业状态帧并启动决策';
    btn.title = '设备已接入，可以启动多Agent决策';
  }
  updateTask?.();
  updateRunGate?.();
  setDispatchButtonState?.();
  setIndustrialStateFrameMedia?.(true);
  return device;
}
function zltxNowText(){
  return new Date().toLocaleTimeString('zh-CN', {hour12:false});
}
function zltxRefreshEvidenceForConnected(){
  const list = document.getElementById('evidenceList');
  if(!list || !isDeviceConnected()) return;
  const t = zltxNowText();
  list.innerHTML = `
    <li><b>1</b><span>设备接入完成<br><em>DEVICE_LINK_READY</em></span><time>${t}</time><i>●</i></li>
    <li><b>2</b><span>通信参数已确认<br><em>TCP_ENDPOINT_VALIDATED</em></span><time>${t}</time><i>●</i></li>
    <li><b>3</b><span>联锁状态待决策核验<br><em>INTERLOCK_PENDING_REVIEW</em></span><time>${t}</time><i>●</i></li>
    <li><b>4</b><span>状态帧可进入Agent链路<br><em>STATE_FRAME_READY</em></span><time>${t}</time><i>◇</i></li>
  `;
}
function zltxRefreshMatrixForConnected(){
  const tbody = document.querySelector('#matrix .matrix-table tbody');
  if(!tbody || !isDeviceConnected()) return;
  tbody.innerHTML = `
    <tr><td>INIT_ARM</td><td class="allow">ALLOW</td><td>控制器在线、设备参数完整</td><td>设备接入校验</td></tr>
    <tr><td>PICK_PLACE</td><td class="allow">ALLOW</td><td>状态帧完整、仲裁完成后解锁</td><td>安全仲裁链路</td></tr>
    <tr><td>STOP_EMG</td><td class="block">BLOCK</td><td>急停或安全门异常时立即阻断</td><td>硬件联锁约束</td></tr>
    <tr><td>RECHECK_VISION</td><td class="allow">ALLOW</td><td>视觉置信度不足时允许复检</td><td>质量复核策略</td></tr>
  `;
}
function zltxRefreshTaskForConnected(){
  const task = document.getElementById('taskJson');
  if(!task || !isDeviceConnected()) return;
  task.textContent = JSON.stringify({
    task_id: 'TASK_WAIT_AGENT_REVIEW',
    task_type: 'PICK_AND_PLACE',
    lifecycle_state: 'READY_FOR_AGENT_REVIEW',
    dispatch_mode: 'AUTO_AFTER_ARBITRATION',
    target_device: {
      arm_id: 'DEVICE-001',
      controller: getStoredDevice()?.controller || '-',
      transport: getStoredDevice()?.protocol || '-'
    },
    precheck: {
      device_connected: true,
      control_link_ready: true,
      interlock_state: 'WAIT_AGENT_ARBITRATION',
      dispatch_authority: 'LOCKED_UNTIL_DECISION_DONE'
    },
    preview_trajectory: [
      {step: 1, action: 'MOVEJ', target: 'HOME_SAFE'},
      {step: 2, action: 'MOVEL', target: 'PRE_PICK'},
      {step: 3, action: 'WAIT_ARBITRATION', rule: 'SAFETY_FIRST'}
    ],
    safety_mode: 'PENDING_REVIEW',
    dispatch_state: 'LOCKED_UNTIL_DECISION_DONE'
  }, null, 2);
}
function zltxRefreshConnectedText(){
  if(!isDeviceConnected()) return;
  zltxRefreshEvidenceForConnected();
  zltxRefreshMatrixForConnected();
  zltxRefreshTaskForConnected();
  document.querySelectorAll('.no-device-hint').forEach(el => el.remove());
}
const zltxRestoreDeviceStateBeforeFinal = typeof zltxRestoreDeviceState === 'function' ? zltxRestoreDeviceState : null;
zltxRestoreDeviceState = function(){
  const ret = zltxRestoreDeviceStateBeforeFinal?.apply(this, arguments);
  if(isDeviceConnected()) zltxRefreshConnectedText();
  return ret || getStoredDevice();
};
const openModuleOverlayBeforeTlzxFinal = typeof openModuleOverlay === 'function' ? openModuleOverlay : null;
openModuleOverlay = function(targetId, title){
  const ret = openModuleOverlayBeforeTlzxFinal?.apply(this, arguments);
  window.setTimeout(() => {
    zltxRestoreDeviceState();
    if(isDeviceConnected()) zltxRefreshConnectedText();
  }, 0);
  return ret;
};
const routeToModuleBeforeDeviceFinal = typeof routeToModule === 'function' ? routeToModule : null;
if(routeToModuleBeforeDeviceFinal){
  routeToModule = function(targetId='workbench', title){
    const ret = routeToModuleBeforeDeviceFinal.apply(this, arguments);
    window.setTimeout(() => {
      zltxRestoreDeviceState();
      if(isDeviceConnected()) zltxRefreshConnectedText();
    }, 80);
    return ret;
  };
}
document.addEventListener('DOMContentLoaded', () => {
  [160, 650, 1500, 3000].forEach(ms => window.setTimeout(zltxRestoreDeviceState, ms));
  document.addEventListener('click', (event) => {
    if(event.target.closest('[data-action="disconnect-device"]')){
      window.setTimeout(zltxUpdateNoDeviceUI, 60);
    }
  }, true);
});
