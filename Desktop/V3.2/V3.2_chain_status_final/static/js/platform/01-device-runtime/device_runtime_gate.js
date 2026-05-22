function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}

function getStoredDevice(){
  try{
    const raw = localStorage.getItem(DEVICE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    console.warn('设备参数读取失败', e);
    return null;
  }
}

function saveStoredDevice(data){
  const payload = {...data, deviceId:'001', connected:true, connectedAt:new Date().toISOString()};
  localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

function clearStoredDevice(){
  localStorage.removeItem(DEVICE_STORAGE_KEY);
}

function isDeviceConnected(){
  const device = getStoredDevice();
  return Boolean(device && device.connected);
}

function setBusVisual(dotId, textId, dotClass, text){
  const dot = $(dotId);
  const el = $(textId);
  if(dot){ dot.className = 'dot ' + dotClass; }
  if(el){ el.textContent = text; el.className = text === 'NO_DEVICE' ? 'bus-off' : 'bus-on'; }
}

function applyDeviceConnectionVisuals(connected){
  setBusVisual('plcDot','plcState', connected ? 'green' : 'gray', connected ? 'ONLINE' : 'NO_DEVICE');
  setBusVisual('sensorDot','sensorState', connected ? 'green' : 'gray', connected ? 'SYNCED' : 'NO_DEVICE');
  setBusVisual('agvDot','agvState', connected ? 'green' : 'gray', connected ? 'ONLINE' : 'NO_DEVICE');
  setBusVisual('crcDot','crcState', connected ? 'green' : 'gray', connected ? 'HEALTHY' : 'NO_DEVICE');
  setBusVisual('armDot','armState', connected ? 'cyan' : 'gray', connected ? 'TRUE' : 'NO_DEVICE');
}

function updateRunGate(){
  const btn = $('startBtn');
  const connected = isDeviceConnected();
  const task = $('currentTask');
  const bus = $('agentBus');
  const focus = $('focusLabel');
  applyDeviceConnectionVisuals(connected);
  if(task) task.textContent = connected ? 'PICK_AND_PLACE' : '无设备连接';
  if(focus && !connected && !running) focus.textContent = '无设备连接';
  if(bus) bus.textContent = connected ? (running ? 'RUNNING' : (bus.textContent === 'DONE' ? 'DONE' : 'STANDBY')) : 'NO_DEVICE';
  if(!btn) return;
  if(connected){
    btn.classList.remove('gated');
    btn.title = '设备已接入，可以启动多Agent决策';
    if(!running && !btn.dataset.completed) btn.innerHTML = '<span>▶</span>采集工业状态帧并启动决策';
  } else {
    btn.classList.add('gated');
    btn.title = '暂无设备连接，请先进入系统配置完成设备参数接入';
    if(!running) btn.innerHTML = '<span>⚠</span>暂无设备连接';
  }
}

function showSystemNotice(title, message, actionText, action){
  let notice = $('systemNotice');
  if(notice) notice.remove();
  notice = document.createElement('div');
  notice.id = 'systemNotice';
  notice.className = 'system-notice';
  notice.innerHTML = `<div><b>${escapeHtml(title)}</b><p>${escapeHtml(message)}</p></div><button>${escapeHtml(actionText || '知道了')}</button>`;
  document.body.appendChild(notice);
  notice.querySelector('button')?.addEventListener('click', () => {
    notice.remove();
    if(typeof action === 'function') action();
  });
  setTimeout(() => notice.classList.add('show'), 20);
}

function selectedOption(value, current){
  return String(value) === String(current || '') ? ' selected' : '';
}

function nodeEl(nodeId){ return $('node-' + nodeId); }
function lineEl(lineId){ return $(lineId); }

function revealNode(nodeId){
  const node = nodeEl(nodeId);
  if(!node) return;
  node.classList.remove('future-node');
  node.classList.add('revealed-node');
}

function hideNode(nodeId){
  const node = nodeEl(nodeId);
  if(!node) return;
  node.classList.add('future-node');
  node.classList.remove('revealed-node','active');
}

function revealLine(lineId, live=false){
  const line = lineEl(lineId);
  if(!line) return;
  line.classList.add('line-visible');
  if(live) line.classList.add('link-live');
}

function hideLine(lineId){
  const line = lineEl(lineId);
  if(!line) return;
  line.classList.remove('line-visible','link-live');
}

function clearLiveLines(){
  document.querySelectorAll('.flow-line').forEach(line => line.classList.remove('link-live'));
}

