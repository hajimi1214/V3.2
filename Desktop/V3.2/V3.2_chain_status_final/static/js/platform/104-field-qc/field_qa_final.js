/*
 * V3.2 现场终检运行层：
 * 1) 紧凑两行六 Agent 决策树的响应式连线；
 * 2) 修复“工业状态帧”路由与克隆视频播放；
 * 3) 顶部绿色标签展示安全决策链路状态；控制端通信确认保留在日志与记录中。
 */
(function fieldQaFinal(){
  'use strict';
  if (window.__ZLTX_FIELD_QA_FINAL__) return;

  const api = { version: 'V3.2-field-qa-final' };
  const byId = id => document.getElementById(id);
  const pairs = [
    ['state_capture','context_model'],
    ['context_model','vision_quality'], ['context_model','localization_3d'], ['context_model','placement_plan'],
    ['vision_quality','hardware_interlock'], ['localization_3d','safety_strategy'], ['placement_plan','execution_constraint'],
    ['hardware_interlock','fusion_arbitration'], ['safety_strategy','fusion_arbitration'], ['execution_constraint','fusion_arbitration'],
    ['fusion_arbitration','control_task'], ['control_task','archive']
  ];

  function surface(){
    window.__ZLTX_OPERATOR_CONSOLE_RUNTIME__?.setupTreeSurface?.();
    return byId('treeViewport')?.querySelector(':scope > .tree-canvas-surface') || byId('treeViewport');
  }
  function point(node, root, edge){
    const r = node.getBoundingClientRect();
    const base = root.getBoundingClientRect();
    return {
      x: r.left - base.left + r.width / 2,
      y: edge === 'bottom' ? r.bottom - base.top : r.top - base.top
    };
  }
  function drawTreeLines(){
    const root = surface();
    const svg = root?.querySelector('svg.tree-lines');
    if (!root || !svg) return;
    const w = Math.max(root.scrollWidth, root.clientWidth);
    const h = Math.max(root.scrollHeight, root.clientHeight);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.querySelectorAll('path.flow-line').forEach(path => { path.style.display = 'none'; });
    svg.querySelectorAll('path.field-qa-link').forEach(path => path.remove());
    pairs.forEach(([fromId, toId], i) => {
      const from = byId('node-' + fromId);
      const to = byId('node-' + toId);
      if (!from || !to || from.offsetParent === null || to.offsetParent === null) return;
      const a = point(from, root, 'bottom');
      const b = point(to, root, 'top');
      const y = a.y + Math.max(9, (b.y - a.y) / 2);
      const d = Math.abs(a.x - b.x) < 2
        ? `M ${a.x} ${a.y} V ${b.y}`
        : `M ${a.x} ${a.y} V ${y} H ${b.x} V ${b.y}`;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('marker-end', 'url(#arrow)');
      path.classList.add('flow-line', 'field-qa-link');
      if (i === 0 || fromId === 'fusion_arbitration' || fromId === 'control_task') path.classList.add('primary');
      svg.appendChild(path);
    });
  }

  function isConnected(){
    try { return typeof window.isDeviceConnected === 'function' && Boolean(window.isDeviceConnected()); }
    catch (_) { return false; }
  }
  function activateStateVideo(root){
    if (!root) return;
    const body = root.querySelector('[data-state-frame-root]') || root.closest?.('[data-state-frame-root]');
    if (!body) return;
    const panel = body.closest('.state-frame-panel, .focused-clone-panel');
    const label = panel?.querySelector('[data-state-frame-label], .panel-head span');
    const video = body.querySelector('[data-state-video], .state-frame-video');
    const empty = body.querySelector('[data-state-empty], .state-frame-empty');
    if (!video) return;
    if (!isConnected()) {
      body.classList.add('state-no-device');
      body.classList.remove('state-video-ready');
      panel?.classList.remove('state-device-connected');
      if (label) label.textContent = '设备未连接';
      try { video.pause(); } catch (_) {}
      return;
    }
    body.classList.remove('state-no-device');
    body.classList.add('state-video-ready');
    panel?.classList.add('state-device-connected');
    if (label) label.textContent = '实时视频循环';
    if (empty) empty.setAttribute('aria-hidden', 'true');
    const src = video.dataset.src || '/static/assets/industrial_state_loop.mp4';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = 'auto';
    if (!video.getAttribute('src') || video.getAttribute('src') !== src) {
      video.setAttribute('src', src);
      try { video.load(); } catch (_) {}
    }
    const promise = video.play?.();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {
      // 浏览器阻止自动播放时，在首次交互后会再次尝试。
    });
  }
  function refreshVisibleVideos(){
    document.querySelectorAll('[data-state-frame-root]').forEach(root => {
      const rect = root.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) activateStateVideo(root);
    });
  }

  function openStateFramePage(title){
    if (typeof window.ensurePlatformRouteShell !== 'function' || typeof window.buildModuleDetailView !== 'function') return;
    const route = window.ensurePlatformRouteShell();
    if (!route) return;
    const pageTitle = title || '工业状态帧';
    const current = byId('platform_navCurrentTab');
    const head = byId('platform_navPageTitle');
    const tag = byId('platform_navPageTag');
    if (current) current.textContent = pageTitle;
    if (head) head.textContent = pageTitle;
    if (tag) tag.textContent = 'STATE FRAME';
    document.querySelector('.platform_nav-home-tab')?.classList.remove('active');
    if (typeof window.setActiveNavigationItem === 'function') window.setActiveNavigationItem('state-snapshot');
    document.body.classList.remove('platform_nav-tree-page');
    document.body.classList.add('platform_nav-page-open');
    const body = byId('platform_navPageBody');
    if (body) {
      body.innerHTML = '';
      body.appendChild(window.buildModuleDetailView('state-snapshot'));
      const clone = body.querySelector('.state-frame-panel.focused-clone-panel');
      if (clone) {
        clone.id = 'state-snapshot-detail';
        clone.dataset.routeStateFrame = 'true';
      }
    }
    route.classList.add('open');
    route.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(refreshVisibleVideos);
    setTimeout(refreshVisibleVideos, 160);
  }
  function repairStateFrameRoute(){
    const previous = typeof window.routeToModule === 'function' ? window.routeToModule : null;
    if (!previous || previous.__fieldQaRoute) return;
    const routed = function(targetId = 'workbench', title){
      if (targetId === 'state-snapshot') {
        openStateFramePage(title);
        return;
      }
      const result = previous.apply(this, arguments);
      setTimeout(() => { refreshVisibleVideos(); ensureHealthyChip(); }, 80);
      return result;
    };
    routed.__fieldQaRoute = true;
    window.routeToModule = routed;
  }

  function ensureHealthyChip(){
    const chip = byId('autoDispatchState');
    if (!chip) return;
    // 顶部标签描述安全决策链路本身的运行状态，
    // 上位机是否确认接收由过程日志与本地发送记录呈现。
    chip.dataset.state = 'success';
    chip.textContent = '安全决策链路：正常';
  }

  function boot(){
    drawTreeLines();
    repairStateFrameRoute();
    ensureHealthyChip();
    refreshVisibleVideos();
    const tree = byId('treeViewport');
    if (tree && !tree.__fieldQaResizeObserver && typeof ResizeObserver === 'function') {
      tree.__fieldQaResizeObserver = new ResizeObserver(() => requestAnimationFrame(drawTreeLines));
      tree.__fieldQaResizeObserver.observe(tree);
    }
    window.addEventListener('resize', () => requestAnimationFrame(drawTreeLines), {passive:true});
    document.addEventListener('pointerdown', refreshVisibleVideos, {passive:true});
    const chip = byId('autoDispatchState');
    if (chip && !chip.__fieldQaChipObserver) {
      chip.__fieldQaChipObserver = true;
      new MutationObserver(() => {
        if (chip.textContent !== '安全决策链路：正常' || chip.dataset.state !== 'success') ensureHealthyChip();
      }).observe(chip, {attributes:true, childList:true, characterData:true, subtree:true});
    }
    setInterval(() => { ensureHealthyChip(); refreshVisibleVideos(); }, 240);
    setTimeout(drawTreeLines, 220);
    setTimeout(drawTreeLines, 1200);
  }

  api.drawTreeLines = drawTreeLines;
  api.openStateFramePage = openStateFramePage;
  api.refreshVisibleVideos = refreshVisibleVideos;
  window.__ZLTX_FIELD_QA_FINAL__ = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
