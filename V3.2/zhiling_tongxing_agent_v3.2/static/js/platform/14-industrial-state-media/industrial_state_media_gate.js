const STATE_MEDIA_VERSION = 'V3.2';
const STATE_MEDIA_BUILD = 'V3.2.0 Build 20260518';
const STATE_VIDEO_SRC = '/static/assets/industrial_state_loop.mp4';

function stopAndUnloadStateVideo(video){
  if(!video) return;
  try{ video.pause(); }catch(e){}
  try{ video.currentTime = 0; }catch(e){}
  video.removeAttribute('src');
  video.preload = 'none';
  try{ video.load(); }catch(e){}
}

function loadAndPlayStateVideo(video){
  if(!video) return;
  const src = video.dataset.src || STATE_VIDEO_SRC;
  video.dataset.src = src;
  video.muted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = 'auto';
  if(video.getAttribute('src') !== src){
    video.setAttribute('src', src);
    try{ video.load(); }catch(e){}
  }
  const playPromise = video.play?.();
  if(playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
}

function setIndustrialStateFrameMedia(connected = isDeviceConnected?.()){
  const isOn = Boolean(connected);
  document.querySelectorAll('[data-state-frame-root]').forEach(root => {
    root.classList.toggle('state-video-ready', isOn);
    root.classList.toggle('state-no-device', !isOn);
    const panel = root.closest('.state-frame-panel,#state-snapshot,.focused-clone-panel,.module-detail-primary');
    panel?.classList.toggle('state-device-connected', isOn);
    panel?.classList.toggle('state-device-offline', !isOn);
    const label = panel?.querySelector('[data-state-frame-label], .panel-head span');
    if(label) label.textContent = isOn ? '实时视频循环' : '设备未连接';
    const empty = root.querySelector('[data-state-empty], .state-frame-empty');
    if(empty){
      empty.style.display = isOn ? 'none' : 'flex';
      empty.setAttribute('aria-hidden', isOn ? 'true' : 'false');
    }
    const video = root.querySelector('[data-state-video], .state-frame-video');
    if(video){
      if(!video.dataset.src) video.dataset.src = video.getAttribute('src') || STATE_VIDEO_SRC;
      if(isOn){
        video.style.display = 'block';
        video.setAttribute('aria-hidden','false');
        loadAndPlayStateVideo(video);
      }else{
        video.style.display = 'none';
        video.setAttribute('aria-hidden','true');
        stopAndUnloadStateVideo(video);
      }
    }
    root.querySelectorAll('.state-frame-metrics b[data-online-value]').forEach(item => {
      item.textContent = isOn ? item.dataset.onlineValue : '未连接';
      item.classList.toggle('online', isOn);
      item.classList.toggle('offline', !isOn);
    });
  });
}

const updateRunGateBeforeRuntimeDocs = typeof updateRunGate === 'function' ? updateRunGate : null;
if(updateRunGateBeforeRuntimeDocs){
  updateRunGate = function(){
    const ret = updateRunGateBeforeRuntimeDocs.apply(this, arguments);
    setIndustrialStateFrameMedia(isDeviceConnected?.());
    return ret;
  };
}

function defaultFlowIdsForStateMedia(){
  if(typeof ROUTE_BASE_FLOW_IDS !== 'undefined' && Array.isArray(ROUTE_BASE_FLOW_IDS)) return ROUTE_BASE_FLOW_IDS;
  if(typeof MANUAL_WORKFLOW_BASE_IDS !== 'undefined' && Array.isArray(MANUAL_WORKFLOW_BASE_IDS)) return MANUAL_WORKFLOW_BASE_IDS;
  return ['state_capture','context_model','vision_quality','localization_3d','placement_plan','hardware_interlock','safety_strategy','execution_constraint','fusion_arbitration','control_task','archive'];
}

function expandDefaultDecisionTreeForStateMedia(){
  document.body.classList.remove('empty-workflow-flow');
  document.body.classList.add('compact-workflow-flow','connected-auto-flow-expanded');
  const ids = defaultFlowIdsForStateMedia();
  document.querySelectorAll('#treeViewport .custom-agent').forEach(n => n.remove());
  ids.forEach(id => {
    const node = getFlowNode?.(id);
    if(!node) return;
    node.classList.remove('workflow-node-hidden','future-node','node-disabled','active','status-running','status-pass','status-done','status-limited','status-blocked');
    node.classList.add('revealed-node','flow-canvas-node','status-waiting');
    node.style.display = '';
    node.style.visibility = 'visible';
    node.style.opacity = '1';
    const btn = node.querySelector('.node-enable-toggle');
    if(btn) btn.textContent = '启用';
  });
  flowConnections = DEFAULT_FLOW_CONNECTIONS.map(x => [...x]);
  const vp = getFlowViewport?.();
  if(vp){
    vp.classList.remove('workflow-canvas-empty');
    try{ vp.scrollTo({left:0, top:0, behavior:'auto'}); }catch(e){ vp.scrollLeft = 0; vp.scrollTop = 0; }
  }
  applyArbitrationMode?.();
  applyCompactFlowLayout?.();
  redrawFlowCanvas?.();
  setCanvasHint?.('Agent自动决策：完整决策树已一次性展开，后续只更新各Agent运行状态，不再逐个生成节点。');
  localizeVisibleStatuses?.();
}

const setupDefaultTopologyBeforeRuntimeDocs = typeof setupDefaultTopologyForRun === 'function' ? setupDefaultTopologyForRun : null;
if(setupDefaultTopologyBeforeRuntimeDocs){
  setupDefaultTopologyForRun = function(){
    setupDefaultTopologyBeforeRuntimeDocs.apply(this, arguments);
    expandDefaultDecisionTreeForStateMedia();
  };
}

const startCanvasDecisionBeforeRuntimeDocs = typeof startCanvasDecision === 'function' ? startCanvasDecision : null;
if(startCanvasDecisionBeforeRuntimeDocs){
  startCanvasDecision = async function(useDefault=false){
    if(!useDefault) return startCanvasDecisionBeforeRuntimeDocs.apply(this, arguments);
    if(running) return;
    if(!isDeviceConnected?.()){
      showSystemNotice?.('暂无设备连接', '请先进入「系统配置」完成设备接入；未连接设备时，工业状态帧显示“暂无设备连接”，不能播放现场视频，也不能启动真实决策。', '进入系统配置', () => {
        if(typeof routeToModule === 'function') routeToModule('config', '系统配置');
        else openModuleOverlay?.('config', '系统配置中心');
      });
      appendLog?.('启动被拦截：暂无设备连接，未加载现场状态视频，自动决策未启动。', new Date().toLocaleTimeString('zh-CN',{hour12:false}));
      updateRunGate?.();
      setIndustrialStateFrameMedia(false);
      return;
    }
    setCanvasMode?.('auto');
    expandDefaultDecisionTreeForStateMedia();
    const levels = typeof computeDefaultLevels === 'function' ? computeDefaultLevels() : [defaultFlowIdsForStateMedia()];
    running = true;
    document.body.classList.add('workflow-template-running','connected-auto-flow-expanded');
    const bus = $('agentBus');
    if(bus){ bus.dataset.state = 'RUNNING'; bus.textContent = typeof localizedStatusText === 'function' ? localizedStatusText('RUNNING') : 'RUNNING'; }
    const btn = $('startBtn');
    if(btn){ delete btn.dataset.completed; btn.innerHTML = '<span>●</span>流程执行中...'; }
    visibleFlowNodes?.().forEach(n => {
      if(!n.classList.contains('node-disabled')) setCanvasNodeStatus?.(n.dataset.node, 'WAITING');
      n.classList.remove('active');
    });
    redrawFlowCanvas?.();
    appendLog?.(`Agent自动决策：完整默认拓扑已一次性展开，共 ${levels.flat().length} 个节点，${flowConnections.length} 条依赖连线。`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
    for(const level of levels){
      if(!running) break;
      // V3.2：节点不再按层级逐个出现，只按层级更新运行状态和审理面板。
      redrawFlowCanvas?.();
      await sleep?.(160);
      level.forEach(id => {
        const node = getFlowNode?.(id);
        if(!node) return;
        node.classList.remove('workflow-node-hidden','future-node');
        setCanvasNodeStatus?.(id, 'RUNNING');
        node.classList.add('active');
        updateAgentPanel?.(buildCanvasAgentPanel?.(id, 'RUNNING'));
      });
      const focus = $('focusLabel');
      if(focus) focus.textContent = level.length > 1 ? `并行决策：${level.length}个Agent` : getNodeMeta?.(level[0])?.name || 'Agent审理中';
      const names = level.map(id => getNodeMeta?.(id)?.name || id).join('、');
      appendLog?.(`${level.length > 1 ? '多Agent并行审查' : '节点审查'}：${names} 正在处理。`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
      localizeVisibleStatuses?.();
      await sleep?.(level.length > 1 ? 2550 : 2100);
      level.forEach(id => {
        const node = getFlowNode?.(id);
        if(!node) return;
        const finalStatus = canvasStatusFor?.(id, false) || 'PASS';
        setCanvasNodeStatus?.(id, finalStatus);
        node.classList.remove('active');
        updateAgentPanel?.(buildCanvasAgentPanel?.(id, finalStatus));
        appendLog?.(`[${getNodeMeta?.(id)?.name || id}] 输出：${getNodeMeta?.(id)?.output || finalStatus} / 状态 ${finalStatus}`, new Date().toLocaleTimeString('zh-CN',{hour12:false}));
      });
      localizeVisibleStatuses?.();
      redrawFlowCanvas?.();
      await sleep?.(360);
    }
    updateTask?.({task_id:'TASK_FLOW_CANVAS_032', type:'PICK_AND_PLACE', safety_mode:'LIMITED'});
    const focus = $('focusLabel');
    if(focus) focus.textContent = '流程画布执行完成';
    const busDone = $('agentBus');
    if(busDone){ busDone.dataset.state = 'DONE'; busDone.textContent = typeof localizedStatusText === 'function' ? localizedStatusText('DONE') : 'DONE'; }
    if(btn){ btn.dataset.completed = 'true'; btn.innerHTML = '<span>✓</span>决策完成，可重新启动'; }
    running = false;
    document.body.classList.remove('workflow-template-running');
    localizeVisibleStatuses?.();
    redrawFlowCanvas?.();
  };
  startDecision = function(){ return flowCanvasMode === 'auto' ? startCanvasDecision(true) : startCanvasDecision(false); };
}

document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-flow-action]')?.dataset.flowAction;
  if(action === 'mode-auto' || action === 'run-default'){
    setTimeout(() => expandDefaultDecisionTreeForStateMedia(), 20);
  }
  if(action === 'mode-manual' || action === 'clear-canvas'){
    document.body.classList.remove('connected-auto-flow-expanded');
  }
}, true);

function applyPlatformVersionLabelsFromRuntimeDocs(){
  document.title = '智领铜行--人工智能机械臂多Agent智能决策平台 V3.2';
  document.querySelectorAll('.brand-ver').forEach(el => el.textContent = STATE_MEDIA_VERSION);
  const version = document.querySelector('.platform-card .pc-row:last-child strong');
  if(version) version.textContent = STATE_MEDIA_BUILD;
  setStatusBusLabels?.();
  setIndustrialStateFrameMedia(isDeviceConnected?.());
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    applyPlatformVersionLabelsFromRuntimeDocs();
    updateRunGate?.();
    setIndustrialStateFrameMedia(isDeviceConnected?.());
  }, 1900);
  const stateFrameObserver = new MutationObserver(() => setIndustrialStateFrameMedia(isDeviceConnected?.()));
  setTimeout(() => {
    const root = document.querySelector('.main-stage') || document.body;
    stateFrameObserver.observe(root, {subtree:true, childList:true});
  }, 1100);
});

/* ========================= V3.2: 页面卡死修复 + 稳定视频门控 =========================
   修复点：
   1. 关闭 历史迭代缓存 的全页面 MutationObserver 轮询式回调，避免状态中文化和视频门控互相触发导致浏览器无响应。
   2. 工业状态帧视频卸载改成幂等逻辑：未连接设备时不加载视频、不显示视频首帧，只显示“暂无设备连接”。
   3. 保留原功能：设备连接后再加载 mp4 并静音循环播放；自动决策仍一次性展开完整决策树。
*/

(function installIndustrialMediaStabilityPatch(){
  const NativeMutationObserver = window.MutationObserver;
  if(NativeMutationObserver && !window.__industrialMediaMutationPatchInstalled){
    window.__industrialMediaMutationPatchInstalled = true;
    window.MutationObserver = function(callback){
      const code = String(callback || '');
      const isLegacyAutoObserver =
        code.includes('localizeVisibleStatuses') ||
        code.includes('setIndustrialStateFrameMedia') ||
        code.includes('setIndustrialStateFrameMedia');
      if(isLegacyAutoObserver){
        return {
          observe(){ /* V3.2：旧版全局观察器会造成自触发循环，这里禁用。 */ },
          disconnect(){},
          takeRecords(){ return []; }
        };
      }
      return new NativeMutationObserver(callback);
    };
    window.MutationObserver.prototype = NativeMutationObserver.prototype;
  }
})();

function stopAndUnloadStateVideo(video){
  if(!video) return;
  try{ video.pause(); }catch(e){}
  try{ if(video.currentTime) video.currentTime = 0; }catch(e){}
  if(video.hasAttribute('src')){
    video.removeAttribute('src');
    try{ video.load(); }catch(e){}
  }
  video.preload = 'none';
  video.autoplay = false;
}

function loadAndPlayStateVideo(video){
  if(!video) return;
  const src = video.dataset.src || STATE_VIDEO_SRC || '/static/assets/industrial_state_loop.mp4';
  video.dataset.src = src;
  video.muted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = 'auto';
  if(video.getAttribute('src') !== src){
    video.setAttribute('src', src);
    try{ video.load(); }catch(e){}
  }
  const playPromise = video.play?.();
  if(playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
}

function setIndustrialStateFrameMedia(connected = isDeviceConnected?.()){
  const isOn = Boolean(connected);
  document.querySelectorAll('[data-state-frame-root]').forEach(root => {
    root.classList.toggle('state-video-ready', isOn);
    root.classList.toggle('state-no-device', !isOn);
    root.dataset.deviceConnected = isOn ? 'true' : 'false';
    const panel = root.closest('.state-frame-panel,#state-snapshot,.focused-clone-panel,.module-detail-primary');
    panel?.classList.toggle('state-device-connected', isOn);
    panel?.classList.toggle('state-device-offline', !isOn);
    const label = panel?.querySelector('[data-state-frame-label], .panel-head span');
    if(label) label.textContent = isOn ? '实时视频循环' : '设备未连接';
    const empty = root.querySelector('[data-state-empty], .state-frame-empty');
    if(empty){
      empty.style.display = isOn ? 'none' : 'flex';
      empty.setAttribute('aria-hidden', isOn ? 'true' : 'false');
    }
    const video = root.querySelector('[data-state-video], .state-frame-video');
    if(video){
      if(!video.dataset.src) video.dataset.src = video.getAttribute('src') || STATE_VIDEO_SRC || '/static/assets/industrial_state_loop.mp4';
      if(isOn){
        video.style.display = 'block';
        video.setAttribute('aria-hidden','false');
        loadAndPlayStateVideo(video);
      }else{
        video.style.display = 'none';
        video.setAttribute('aria-hidden','true');
        stopAndUnloadStateVideo(video);
      }
    }
    root.querySelectorAll('.state-frame-metrics b[data-online-value]').forEach(item => {
      const next = isOn ? item.dataset.onlineValue : '未连接';
      if(item.textContent !== next) item.textContent = next;
      item.classList.toggle('online', isOn);
      item.classList.toggle('offline', !isOn);
    });
  });
}

// 让 V3.2 内部调用到的卸载/播放函数也变成幂等版本，避免重复 load()。
try{
  stopAndUnloadStateVideo = stopAndUnloadStateVideo;
  loadAndPlayStateVideo = loadAndPlayStateVideo;
  setIndustrialStateFrameMedia = setIndustrialStateFrameMedia;
}catch(e){}

const updateRunGateBeforeIndustrialMedia = typeof updateRunGate === 'function' ? updateRunGate : null;
if(updateRunGateBeforeIndustrialMedia){
  updateRunGate = function(){
    const ret = updateRunGateBeforeIndustrialMedia.apply(this, arguments);
    localizeVisibleStatuses?.();
    setIndustrialStateFrameMedia(isDeviceConnected?.());
    return ret;
  };
}

const routeToModuleBeforeIndustrialMedia = typeof routeToModule === 'function' ? routeToModule : null;
if(routeToModuleBeforeIndustrialMedia){
  routeToModule = function(targetId='workbench', title){
    const ret = routeToModuleBeforeIndustrialMedia.apply(this, arguments);
    requestAnimationFrame(() => {
      localizeVisibleStatuses?.();
      setIndustrialStateFrameMedia(isDeviceConnected?.());
      redrawFlowCanvas?.();
    });
    return ret;
  };
}

function applyPlatformVersionLabelsFromIndustrialMedia(){
  document.title = '智领铜行--人工智能机械臂多Agent智能决策平台 V3.2';
  document.querySelectorAll('.brand-ver').forEach(el => el.textContent = STATE_MEDIA_VERSION);
  const version = document.querySelector('.platform-card .pc-row:last-child strong');
  if(version) version.textContent = STATE_MEDIA_BUILD;
  setStatusBusLabels?.();
  localizeVisibleStatuses?.();
  setIndustrialStateFrameMedia(isDeviceConnected?.());
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    applyPlatformVersionLabelsFromIndustrialMedia();
    updateRunGate?.();
    setIndustrialStateFrameMedia(isDeviceConnected?.());
  }, 2050);
});

document.addEventListener('click', () => {
  setTimeout(() => {
    localizeVisibleStatuses?.();
    setIndustrialStateFrameMedia(isDeviceConnected?.());
  }, 80);
}, true);

/* ========================= V3.2: 设备门控空白画布 + 自动决策逐步生成 =========================
   修复点：
   1. 未连接设备时，决策树画布必须保持空白，不能显示默认决策流程树。
   2. 点击 Agent自动决策 / 一键执行默认配置 时，若未连接设备，直接拦截并保持空白。
   3. 已连接设备后执行自动决策，流程节点按层级逐步出现，不再一次性全部展开。
   4. 优化自动决策树布局：专家Agent改为两行三列，减轻一行六个节点过挤的问题。
*/
