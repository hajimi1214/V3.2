/*
 * V3.2 决策树经典风格复原脚本
 * 只负责把旧版画布风格的坐标、连线、滚轮/拖拽浏览稳定下来。
 */
(function decisionConsoleRestyle(){
  'use strict';
  if (window.__ZLTX_DECISION_CONSOLE_RESTYLE__) return;

  const state = { version:'V3.2-classic-decision-console' };
  const $ = (id) => document.getElementById(id);

  function ensureSurface(){
    const viewport = $('treeViewport');
    if (!viewport) return null;
    let surface = viewport.querySelector(':scope > .tree-canvas-surface');
    if (!surface) {
      surface = document.createElement('div');
      surface.className = 'tree-canvas-surface';
      while (viewport.firstChild) surface.appendChild(viewport.firstChild);
      viewport.appendChild(surface);
    }
    return surface;
  }

  function updateLines(){
    const surface = ensureSurface();
    if (!surface) return;
    const svg = surface.querySelector('svg.tree-lines');
    if (!svg) return;
    svg.setAttribute('viewBox', '0 0 1580 560');
    svg.setAttribute('preserveAspectRatio', 'none');
    const set = (id, d) => { const p = surface.querySelector('#' + id); if (p) p.setAttribute('d', d); };

    // 从状态帧和建模节点进入两排Agent审查，再汇聚到右侧仲裁链路。
    set('line-state_capture-context_model', 'M296 136 C324 136 324 350 354 350');
    set('line-context_model-branch', 'M296 350 H326');
    set('line-branch-bus', 'M326 128 H1252 M326 374 H1252');
    set('line-agent-stems', 'M354 128 V128 M660 128 V128 M966 128 V128 M354 374 V374 M660 374 V374 M966 374 V374');
    set('line-merge-bus', 'M624 128 H1292 M930 128 H1292 M1236 128 H1292 M624 374 H1292 M930 374 H1292 M1236 374 H1292');
    set('line-fusion-control', 'M1417 196 V242');
    set('line-control-archive', 'M1417 354 V402');
    set('line-add-agent', 'M0 0');
  }

  function centerInitial(){
    const viewport = $('treeViewport');
    if (!viewport) return;
    // 主页面默认展示从输入到主要Agent，稍微偏左；独立决策树页展示中部。
    const isTreePage = document.body.classList.contains('platform_nav-tree-page');
    const surface = viewport.querySelector(':scope > .tree-canvas-surface');
    if (!surface) return;
    const target = isTreePage ? Math.max(0, (surface.scrollWidth - viewport.clientWidth) * 0.22) : Math.max(0, (surface.scrollWidth - viewport.clientWidth) * 0.10);
    viewport.scrollLeft = target;
  }

  function patchThemeButton(){
    const btn = $('presentationThemeToggle');
    if (!btn) return;
    const isLight = document.body.classList.contains('zltx-theme-light');
    btn.textContent = isLight ? '主题：工业白' : '主题：石墨金';
    btn.title = '切换工业白 / 石墨金显示主题';
  }

  function observeTheme(){
    if (document.body.__classicThemeObserved) return;
    document.body.__classicThemeObserved = true;
    const obs = new MutationObserver(patchThemeButton);
    obs.observe(document.body, {attributes:true, attributeFilter:['class']});
  }

  function boot(){
    ensureSurface();
    updateLines();
    patchThemeButton();
    observeTheme();
    setTimeout(() => { ensureSurface(); updateLines(); centerInitial(); patchThemeButton(); }, 160);
    setTimeout(() => { ensureSurface(); updateLines(); patchThemeButton(); }, 900);
    setTimeout(() => { ensureSurface(); updateLines(); patchThemeButton(); }, 2400);
  }

  state.updateLines = updateLines;
  window.__ZLTX_DECISION_CONSOLE_RESTYLE__ = state;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
