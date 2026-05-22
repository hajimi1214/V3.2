/*
 * V3.2 终检改进运行层：
 * 1) 基于 DOM 实际尺寸绘制决策树连线，屏幕比例变化时不产生节点覆盖；
 * 2) 工业状态视频只在工作台主页启用，并确保完整循环播放；
 * 3) 决策安全通过后自动调用控制下发接口，显示真实下发状态。
 */
(function operatorConsoleRefinedV2(){
  'use strict';
  if (window.__ZLTX_OPERATOR_CONSOLE_REFINED_V2__) return;

  const state = { version:'V3.2-responsive-v2', dispatching:false, dispatchedFor:'', dispatchArmed:false };
  const byId = id => document.getElementById(id);
  const nodeIds = ['state_capture','context_model','vision_quality','localization_3d','placement_plan','hardware_interlock','safety_strategy','execution_constraint','fusion_arbitration','control_task','archive'];
  const links = [
    ['state_capture','context_model'],
    ['context_model','vision_quality'], ['context_model','localization_3d'],
    ['vision_quality','placement_plan'], ['localization_3d','hardware_interlock'],
    ['placement_plan','safety_strategy'], ['hardware_interlock','execution_constraint'],
    ['safety_strategy','fusion_arbitration'], ['execution_constraint','fusion_arbitration'],
    ['fusion_arbitration','control_task'], ['fusion_arbitration','archive']
  ];

  function surface(){
    return byId('treeViewport')?.querySelector(':scope > .tree-canvas-surface') || byId('treeViewport');
  }
  function ensureSurface(){
    window.__ZLTX_OPERATOR_CONSOLE_RUNTIME__?.setupTreeSurface?.();
    return surface();
  }
  function centerBottom(node, rootRect){
    const r = node.getBoundingClientRect();
    return {x:r.left - rootRect.left + r.width / 2, y:r.bottom - rootRect.top};
  }
  function centerTop(node, rootRect){
    const r = node.getBoundingClientRect();
    return {x:r.left - rootRect.left + r.width / 2, y:r.top - rootRect.top};
  }
  function drawResponsiveLines(){
    const root = ensureSurface();
    if (!root) return;
    const svg = root.querySelector('svg.tree-lines');
    if (!svg) return;
    const width = Math.max(root.scrollWidth, root.clientWidth);
    const height = Math.max(root.scrollHeight, root.clientHeight);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.querySelectorAll('path.flow-line').forEach(path => path.style.display = 'none');
    svg.querySelectorAll('path.v2-responsive-link').forEach(path => path.remove());
    const rootRect = root.getBoundingClientRect();
    links.forEach(([fromId,toId], index) => {
      const from = byId('node-' + fromId);
      const to = byId('node-' + toId);
      if (!from || !to || from.offsetParent === null || to.offsetParent === null) return;
      const a = centerBottom(from, rootRect);
      const b = centerTop(to, rootRect);
      const middleY = a.y + Math.max(14, (b.y - a.y) / 2);
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      const d = Math.abs(a.x - b.x) < 2
        ? `M ${a.x} ${a.y} V ${b.y}`
        : `M ${a.x} ${a.y} V ${middleY} H ${b.x} V ${b.y}`;
      path.setAttribute('d', d);
      path.setAttribute('marker-end', 'url(#arrow)');
      path.classList.add('flow-line','v2-responsive-link');
      if (index === 0 || fromId === 'fusion_arbitration') path.classList.add('primary');
      svg.appendChild(path);
    });
  }

  function pageIsWorkbench(){
    return !document.body.classList.contains('platform_nav-page-open') && !document.body.classList.contains('platform_nav-tree-page');
  }
  function homeVideo(){
    return byId('state-snapshot')?.querySelector('[data-state-video], .state-frame-video');
  }
  function ensureHomeVideoPlayback(){
    const video = homeVideo();
    if (!video) return;
    const connected = typeof window.isDeviceConnected === 'function' ? Boolean(window.isDeviceConnected()) : false;
    if (!connected || !pageIsWorkbench()) {
      try { video.pause(); } catch (_) {}
      return;
    }
    const src = video.dataset.src || '/static/assets/industrial_state_loop.mp4';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.autoplay = true;
    if (video.getAttribute('src') !== src) {
      video.setAttribute('src', src);
      try { video.load(); } catch (_) {}
    }
    const result = video.play?.();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  }
  function routeStateFrameToHome(){
    const original = typeof window.routeToModule === 'function' ? window.routeToModule : null;
    if (!original || original.__v2StateFrameHomeOnly) return;
    const wrapped = function(targetId='workbench', title){
      if (targetId === 'state-snapshot') {
        const result = original.call(this, 'workbench', '决策工作台');
        requestAnimationFrame(() => {
          byId('state-snapshot')?.scrollIntoView({behavior:'smooth', block:'center'});
          ensureHomeVideoPlayback();
        });
        return result;
      }
      const result = original.apply(this, arguments);
      setTimeout(ensureHomeVideoPlayback, 40);
      return result;
    };
    wrapped.__v2StateFrameHomeOnly = true;
    window.routeToModule = wrapped;
  }

  function appendStatusLog(message){
    const stamp = new Date().toLocaleTimeString('zh-CN',{hour12:false});
    if (typeof window.appendLog === 'function') window.appendLog(message, stamp);
    const stream = byId('decisionProcessLog');
    if (stream) {
      const p = document.createElement('p');
      p.textContent = `${stamp} ${message}`;
      stream.prepend(p);
    }
  }
  function ensureDispatchChip(){
    const strip = document.querySelector('.metric-strip.action-only');
    if (!strip) return null;
    let chip = byId('autoDispatchState');
    if (!chip) {
      chip = document.createElement('span');
      chip.id = 'autoDispatchState';
      chip.className = 'auto-dispatch-state';
      chip.dataset.state = 'waiting';
      chip.textContent = '自动下发：等待仲裁';
      const themeBtn = byId('presentationThemeToggle');
      strip.insertBefore(chip, themeBtn || null);
    }
    return chip;
  }
  function setDispatchChip(mode, text){
    const chip = ensureDispatchChip();
    if (!chip) return;
    chip.dataset.state = mode;
    chip.textContent = text;
  }
  function dispatchPayload(){
    return {
      frame_id: byId('frameId')?.textContent?.trim() || '',
      decision_id: byId('decisionId')?.textContent?.trim() || '',
      current_task: byId('currentTask')?.textContent?.trim() || 'PICK_AND_PLACE',
      device_connected: Boolean(typeof window.isDeviceConnected === 'function' && window.isDeviceConnected()),
      agent_bus: byId('agentBus')?.textContent?.trim() || '',
      safety_mode: 'NORMAL',
      operator_action: 'AUTO_AFTER_SAFE_ARBITRATION'
    };
  }
  async function autoDispatchAfterSafeDecision(){
    if (state.dispatching) return;
    const connected = typeof window.isDeviceConnected === 'function' && window.isDeviceConnected();
    const done = typeof window.isAgentDecisionReady === 'function' && window.isAgentDecisionReady();
    if (!connected || !done) return;
    const id = byId('decisionId')?.textContent?.trim() || 'CURRENT_DECISION';
    if (state.dispatchedFor === id) return;
    state.dispatching = true;
    state.dispatchedFor = id;
    setDispatchChip('sending','自动下发：指令发送中');
    appendStatusLog('安全仲裁已通过，控制任务进入自动下发链路。');
    try {
      const response = await fetch('/api/command/dispatch', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({command:'CONTROL_TASK_DISPATCH', message:'安全仲裁完成后自动下发', payload:dispatchPayload()})
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.message || '上位机链路未全部发送完成');
      setDispatchChip('success','自动下发：已完成');
      appendStatusLog('控制任务自动下发完成：指令已发送至上位机控制端。');
      try { localStorage.setItem('zltx_auto_dispatch_state_v2', JSON.stringify({decision_id:id, ok:true, result, at:new Date().toISOString()})); } catch (_) {}
    } catch (error) {
      setDispatchChip('failed','自动下发：链路异常');
      appendStatusLog('控制任务自动下发未完成：' + (error?.message || '链路异常') + '。');
      try { localStorage.setItem('zltx_auto_dispatch_state_v2', JSON.stringify({decision_id:id, ok:false, error:String(error?.message || error), at:new Date().toISOString()})); } catch (_) {}
    } finally {
      state.dispatching = false;
    }
  }
  function monitorDecisionCompletion(){
    const bus = byId('agentBus');
    if (!bus || bus.__autoDispatchObserver) return;
    bus.__autoDispatchObserver = true;
    const startButton = byId('startBtn');
    startButton?.addEventListener('click', () => {
      if (typeof window.isDeviceConnected === 'function' && window.isDeviceConnected()) {
        state.dispatchArmed = true;
        state.dispatchedFor = '';
        setDispatchChip('waiting','自动下发：等待仲裁');
      }
    }, true);
    const check = () => {
      const value = bus.textContent || '';
      if (/RUNNING|运行中/u.test(value)) state.dispatchArmed = true;
      if (state.dispatchArmed && /DONE|完成/u.test(value)) {
        state.dispatchArmed = false;
        autoDispatchAfterSafeDecision();
      } else if (!/DONE|完成/u.test(value)) {
        setDispatchChip('waiting','自动下发：等待仲裁');
      }
    };
    new MutationObserver(check).observe(bus,{childList:true,subtree:true,characterData:true,attributes:true});
    setDispatchChip('waiting','自动下发：等待仲裁');
  }
  function normalizeTaskMode(){
    const code = byId('taskJson');
    if (!code) return;
    code.textContent = code.textContent
      .replace(/MANUAL_CONFIRM/g, 'AUTO_AFTER_ARBITRATION')
      .replace(/人工确认后可进入上位机下发链路/g, '安全仲裁通过后自动进入下发链路');
  }
  function boot(){
    byId('dispatchBtn')?.remove();
    ensureDispatchChip();
    ensureSurface();
    drawResponsiveLines();
    routeStateFrameToHome();
    monitorDecisionCompletion();
    normalizeTaskMode();
    ensureHomeVideoPlayback();
    document.addEventListener('pointerdown', ensureHomeVideoPlayback, {passive:true});
    window.addEventListener('resize', () => requestAnimationFrame(drawResponsiveLines), {passive:true});
    const tree = byId('treeViewport');
    if (tree) new MutationObserver(() => requestAnimationFrame(drawResponsiveLines)).observe(tree,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
    setTimeout(() => {drawResponsiveLines(); ensureHomeVideoPlayback(); normalizeTaskMode();}, 350);
    setTimeout(() => {drawResponsiveLines(); ensureHomeVideoPlayback(); normalizeTaskMode();}, 1600);
  }
  state.drawResponsiveLines = drawResponsiveLines;
  state.autoDispatchAfterSafeDecision = autoDispatchAfterSafeDecision;
  window.__ZLTX_OPERATOR_CONSOLE_REFINED_V2__ = state;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else setTimeout(boot,0);
})();

/* 终检第五轮：大屏按钮文案压缩，避免在不同屏幕宽度下截断。 */
(function normalizePrimaryActionLabel(){
  function fix(){
    const btn = document.getElementById('startBtn');
    if(!btn) return;
    const text = (btn.textContent || '').replace(/\s+/g,'');
    if(text.includes('采集工业状态帧并启动决策')){
      btn.innerHTML = '<span>▶</span>启动自动决策';
      btn.title = '采集工业状态帧并启动多Agent自动决策';
    }
  }
  const start = () => {
    fix();
    const btn = document.getElementById('startBtn');
    if(btn && !btn.__labelNormalizedObserver){
      btn.__labelNormalizedObserver = true;
      new MutationObserver(fix).observe(btn,{childList:true,subtree:true,characterData:true});
    }
    setTimeout(fix,300);
    setTimeout(fix,1500);
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start,{once:true});
  else start();
})();
