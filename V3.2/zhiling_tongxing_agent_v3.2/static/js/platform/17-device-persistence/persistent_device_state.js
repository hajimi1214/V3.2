const ZLTX_DEVICE_KEY = 'zltx_device_config_stable';
const ZLTX_DEVICE_KEYS = [
  ZLTX_DEVICE_KEY,
  'zhiling_tongxing_device_config_active',
  'zltx_device_config_default_manual',
  'zltx_device_config_primary',
  'zltx_device_config_primary',
  'zltx_device_config_primary',
  'zltx_device_config_primary',
  'zltx_device_config_primary',
  'zltx_device_config_primary'
];

function zltxDefaultDevice() {
  return {
    deviceName: '工业机械臂主站',
    deviceType: '工业机械臂',
    model: 'ZLTX-R6-1450',
    protocol: 'TCP Socket',
    ip: '192.168.1.109',
    port: '9000',
    controller: 'PLC-A03',
    payload: '5kg / 0.7m/s',
    remark: '铜箔卷抓放工位联动设备',
    deviceId: '001',
    connected: true
  };
}

function zltxNormalizeDevice(data = {}) {
  return {
    ...zltxDefaultDevice(),
    ...data,
    deviceId: data.deviceId || '001',
    connected: true,
    connectedAt: data.connectedAt || new Date().toISOString()
  };
}

function zltxReadAnyDevice() {
  for (const key of ZLTX_DEVICE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data && data.connected) return zltxNormalizeDevice(data);
    } catch (e) {}
  }
  return null;
}

function zltxWriteDevice(data) {
  const payload = zltxNormalizeDevice(data);
  ZLTX_DEVICE_KEYS.forEach(key => localStorage.setItem(key, JSON.stringify(payload)));
  return payload;
}

function getStoredDevice() {
  const data = zltxReadAnyDevice();
  if (data) zltxWriteDevice(data);
  return data;
}

function saveStoredDevice(data) {
  return zltxWriteDevice(data);
}

function clearStoredDevice() {
  ZLTX_DEVICE_KEYS.forEach(key => localStorage.removeItem(key));
}

function isDeviceConnected() {
  const device = getStoredDevice();
  return Boolean(device && device.connected);
}

function zltxSelect(name, value, items) {
  return `<select name="${name}">${items.map(item => `<option value="${escapeHtml(item)}"${item === value ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select>`;
}

function buildDeviceConfigView() {
  const saved = getStoredDevice();
  const d = saved || zltxDefaultDevice();
  const wrap = document.createElement('div');
  wrap.className = 'device-config-page';
  wrap.innerHTML = `
    <section class="device-card">
      <div class="device-card-head">
        <div><span>HARDWARE CONFIG</span><h3>硬件设备信息确认</h3></div>
        <div class="device-badge">设备参数接入</div>
      </div>
      <form id="deviceForm" class="device-form" autocomplete="off">
        <div class="device-field"><label>设备名称</label>${zltxSelect('deviceName', d.deviceName, ['工业机械臂主站','AGV协同车','双目视觉单元','PLC联锁控制站'])}</div>
        <div class="device-field"><label>设备类型</label>${zltxSelect('deviceType', d.deviceType, ['工业机械臂','AGV小车','双目相机','PLC控制器','末端夹具'])}</div>
        <div class="device-field"><label>设备品牌 / 型号</label>${zltxSelect('model', d.model, ['ZLTX-R6-1450','ARM-C6-1450','PLC-A03','VISION-SGBM-02','AGV-MOVE-01'])}</div>
        <div class="device-field"><label>通信协议</label>${zltxSelect('protocol', d.protocol, ['TCP Socket','Modbus TCP','EtherCAT','OPC UA','ROS2 Bridge'])}</div>
        <div class="device-field"><label>设备 IP</label><input name="ip" value="${escapeHtml(d.ip || '192.168.1.109')}" placeholder="192.168.1.109"></div>
        <div class="device-field"><label>端口</label><input name="port" value="${escapeHtml(d.port || '9000')}" placeholder="9000"></div>
        <div class="device-field"><label>控制器编号</label>${zltxSelect('controller', d.controller, ['PLC-A03','PLC-A04','CTRL-R6-01','IO-LINK-01'])}</div>
        <div class="device-field"><label>负载 / 速度</label>${zltxSelect('payload', d.payload, ['5kg / 0.7m/s','8kg / 0.5m/s','3kg / 1.0m/s','10kg / 0.4m/s'])}</div>
        <input type="hidden" name="remark" value="${escapeHtml(d.remark || '铜箔卷抓放工位联动设备')}">
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

function zltxRestoreDeviceState() {
  const device = getStoredDevice();
  if (!device) return;
  zltxWriteDevice(device);
  applyDeviceConnectionVisuals?.(true);
  const task = $('currentTask');
  if (task) task.textContent = 'PICK_AND_PLACE';
  const bus = $('agentBus');
  if (bus && (bus.textContent === 'NO_DEVICE' || bus.textContent === '未连接')) bus.textContent = 'STANDBY';
  const focus = $('focusLabel');
  if (focus && focus.textContent.includes('无设备')) focus.textContent = '设备状态已确认';
  const btn = $('startBtn');
  if (btn) {
    btn.classList.remove('gated');
    if (!btn.dataset.completed && !running) btn.innerHTML = '<span>▶</span>启动自动决策';
    btn.title = '设备已接入，可以启动多Agent决策';
  }
  updateTask?.();
  setDispatchButtonState?.();
  setIndustrialStateFrameMedia?.(true);
  setIndustrialStateFrameMedia?.(true);
  setIndustrialStateFrameMedia?.(true);
}

document.addEventListener('DOMContentLoaded', () => {
  zltxRestoreDeviceState();
  setTimeout(zltxRestoreDeviceState, 200);
  setTimeout(zltxRestoreDeviceState, 800);
  setTimeout(zltxRestoreDeviceState, 1600);
  setTimeout(zltxRestoreDeviceState, 3200);
});



function zltxNowText() {
  return new Date().toLocaleTimeString('zh-CN', {hour12:false});
}

function zltxApplyConnectedModuleMeta() {
  if (!window.MODULE_DETAIL_META) return;
  if (MODULE_DETAIL_META.matrix) {
    MODULE_DETAIL_META.matrix.desc = '把最终动作约束为ALLOW、LIMITED、BLOCK或WAIT；设备接入后根据联锁、安全策略和执行约束动态判定。';
    MODULE_DETAIL_META.matrix.bullets = ['设备接入后动作权限实时解锁', '硬件联锁异常时限制或阻断', '执行约束超限时转为LIMITED', '控制任务通过矩阵后才能生成'];
  }
  if (MODULE_DETAIL_META['control-task']) {
    MODULE_DETAIL_META['control-task'].desc = '展示最终控制任务JSON和动作下发前的安全参数，设备接入后可进入上位机执行链路。';
    MODULE_DETAIL_META['control-task'].bullets = ['MOVEJ / MOVEL / PICK动作序列', '速度缩放、安全模式和有效期', '来源于控制任务生成Agent', '设备接入后允许进入指令下发阶段'];
  }
}

function zltxRefreshEvidenceForConnected() {
  const list = document.getElementById('evidenceList');
  if (!list) return;
  const t = zltxNowText();
  list.innerHTML = `
    <li><b>1</b><span>设备状态帧已接入<br><em>STATE_FRAME_READY</em></span><time>${t}</time><i>●</i></li>
    <li><b>2</b><span>相机/点云链路同步<br><em>SENSOR_BUS_SYNCED</em></span><time>${t}</time><i>●</i></li>
    <li><b>3</b><span>算法模型输入已确认<br><em>MODEL_INPUT_READY</em></span><time>${t}</time><i>●</i></li>
    <li><b>4</b><span>设备连接已确认<br><em>DEVICE_CONNECTED</em></span><time>${t}</time><i>●</i></li>
    <li class="active"><b>5</b><span>决策链路可执行<br><em>AGENT_FLOW_READY</em></span><time>${t}</time><i>◇</i></li>
  `;
}

function zltxRefreshMatrixForConnected() {
  const tbody = document.querySelector('#matrix .matrix-table tbody');
  if (!tbody) return;
  tbody.innerHTML = `
    <tr><td>INIT_ARM</td><td class="allow">ALLOW</td><td>CRC通过、急停释放、控制器在线</td><td>硬件联锁Agent</td></tr>
    <tr><td>PICK_PLACE</td><td class="allow">ALLOW</td><td>坐标有效、路径可达、权限矩阵通过</td><td>执行约束Agent</td></tr>
    <tr><td>STOP_EMG</td><td class="block">BLOCK</td><td>急停或安全联锁触发时强制阻断</td><td>硬件联锁Agent</td></tr>
    <tr><td>RECHECK_VISION</td><td class="allow">ALLOW</td><td>视觉置信度异常时允许复检</td><td>视觉质量Agent</td></tr>
  `;
}

function zltxRefreshTaskForConnected() {
  const task = document.getElementById('taskJson');
  if (!task) return;
  task.textContent = JSON.stringify({
    task_id: 'TASK_20260305_00032',
    type: 'PICK_AND_PLACE',
    arm_id: 'DEVICE-001',
    trajectory: [
      {step: 1, action: 'MOVEJ', target: 'PRE_PICK'},
      {step: 2, action: 'MOVEL', target: 'PICK_ZONE'},
      {step: 3, action: 'PICK', target: 'COPPER_ROLL'},
      {step: 4, action: 'MOVEL', target: 'PLACE_ZONE'}
    ],
    speed_scale: 0.7,
    safety_mode: 'SAFETY_FIRST',
    dispatch_state: 'READY'
  }, null, 2);
}

function zltxRefreshConnectedText() {
  if (!isDeviceConnected?.()) return;
  zltxApplyConnectedModuleMeta();
  zltxRefreshEvidenceForConnected();
  zltxRefreshMatrixForConnected();
  zltxRefreshTaskForConnected();
  document.querySelectorAll('.no-device-hint').forEach(el => el.remove());
  document.querySelectorAll('.module-detail-side li, .module-detail-hero p, .control-lifecycle-card p').forEach(el => {
    el.textContent = el.textContent
      .replace(/无设备连接时全部LOCKED/g, '设备接入后动作权限实时判定')
      .replace(/未连接设备时只保留预览不允许下发/g, '设备接入后可进入指令下发阶段')
      .replace(/未接入硬件设备时，平台只生成预览任务，不允许真实下发。/g, '设备接入后，控制任务通过仲裁和权限矩阵后进入下发阶段。')
      .replace(/当前无设备连接：模块仅展示配置\/预览，不能启动真实决策链路。/g, '当前设备已连接：模块可参与多Agent决策链路。');
  });
}

const zltxRestoreDeviceStateBeforeFinal = typeof zltxRestoreDeviceState === 'function' ? zltxRestoreDeviceState : null;
zltxRestoreDeviceState = function() {
  const ret = zltxRestoreDeviceStateBeforeFinal?.apply(this, arguments);
  zltxRefreshConnectedText();
  return ret;
};

const openModuleOverlayBeforeTlzxFinal = typeof openModuleOverlay === 'function' ? openModuleOverlay : null;
openModuleOverlay = function(targetId, title) {
  const ret = openModuleOverlayBeforeTlzxFinal?.apply(this, arguments);
  setTimeout(zltxRefreshConnectedText, 0);
  setTimeout(zltxRefreshConnectedText, 120);
  return ret;
};

document.addEventListener('DOMContentLoaded', () => {
  [300, 900, 1800, 3600].forEach(ms => setTimeout(zltxRefreshConnectedText, ms));
});


const updateRunGateBeforeTlzxFinal = typeof updateRunGate === 'function' ? updateRunGate : null;
if (updateRunGateBeforeTlzxFinal && !window.__zltxFinalRunGatePatch) {
  window.__zltxFinalRunGatePatch = true;
  updateRunGate = function() {
    const ret = updateRunGateBeforeTlzxFinal.apply(this, arguments);
    setTimeout(zltxRefreshConnectedText, 0);
    return ret;
  };
}
