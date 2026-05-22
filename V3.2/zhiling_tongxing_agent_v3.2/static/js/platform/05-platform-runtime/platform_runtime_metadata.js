const PLATFORM_VERSION = 'V3.2';
const PLATFORM_BUILD = 'V3.2.0 Build 20260518';
const PLATFORM_START_TIME = new Date('2026-03-05T09:46:00');

function formatPlatformUptime(now = new Date()) {
  const diff = Math.max(0, now.getTime() - PLATFORM_START_TIME.getTime());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${days}天 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function clock(){
  const t = formatPlatformUptime(new Date());
  if($('sideRuntime')) $('sideRuntime').textContent = t;
  if($('runtimeTop')) $('runtimeTop').textContent = t;
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
}

document.addEventListener('DOMContentLoaded', () => {
  $('startBtn').addEventListener('click', startDecision);
  document.querySelectorAll('.nav-item,.nav-subitem').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.getAttribute('href').replace('#','');
      const title = item.querySelector('b')?.textContent || moduleTitleMap[targetId];
      focusModuleFromNav(targetId, title);
    });
  });
  $('overlayClose')?.addEventListener('click', () => {
    $('moduleOverlay').classList.remove('open');
    $('moduleOverlay').setAttribute('aria-hidden','true');
  });
  $('moduleOverlay')?.addEventListener('click', (e) => {
    if(e.target === $('moduleOverlay')) {
      $('moduleOverlay').classList.remove('open');
      $('moduleOverlay').setAttribute('aria-hidden','true');
    }
  });
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && $('moduleOverlay')?.classList.contains('open')) {
      $('moduleOverlay').classList.remove('open');
      $('moduleOverlay').setAttribute('aria-hidden','true');
    }
    if(e.key === 'Escape' && $('reportPrintModal')?.classList.contains('open')) closeArchiveReport();
  });
  document.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if(!actionEl) return;
    const action = actionEl.dataset.action;
    if(action === 'open-device-config') openModuleOverlay('device-config', '系统配置 / 设备参数接入');
    if(action === 'open-config-detail') {
      const type = actionEl.dataset.config;
      const content = $('overlayContent');
      const title = $('overlayTitle');
      if(content){ content.innerHTML = ''; content.appendChild(buildConfigDetailView(type)); }
      if(title) title.textContent = moduleTitleMap.config || '系统配置中心';
    }
    if(action === 'back-config-center') {
      const content = $('overlayContent');
      if(content){ content.innerHTML = ''; content.appendChild(buildConfigCenterView()); }
    }
    if(action === 'show-report-log') showArchiveReport();
    if(action === 'print-archive-pdf') printArchiveReport();
    if(action === 'close-report-log') closeArchiveReport();
    if(action === 'disconnect-device') {
      clearStoredDevice();
      const content = $('overlayContent');
      if(content && $('moduleOverlay')?.classList.contains('open')) {
        content.innerHTML = '';
        content.appendChild(buildDeviceConfigView());
        bindDeviceConfigView(content);
      }
      updateRunGate();
      updateTask();
      appendLog('设备001已断开并删除，本地设备参数已清空，决策链路重新锁定。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
      showSystemNotice('设备已断开', 'DEVICE-001 已删除。当前平台回到无设备连接状态，启动决策前需要重新配置设备参数。', '知道了');
    }
  });
  $('reportPrintModal')?.addEventListener('click', (e) => { if(e.target === $('reportPrintModal')) closeArchiveReport(); });
  loadMeta();
  prepareInitialTree();
  updateRunGate();
  appendLog('等待启动：当前只显示状态帧采集入口，下游Agent将在决策过程中逐步生成。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
  setInterval(clock, 1000);
});


