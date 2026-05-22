/**
 * 决策树画布浏览运行层：提供画布封装、滚轮浏览和鼠标拖动查看。
 * 不改写决策结果，不额外触发控制指令下发。
 */
(function operatorConsoleRuntime(){
  'use strict';
  if (window.__ZLTX_OPERATOR_CONSOLE_RUNTIME__) return;

  function setupTreeSurface(){
    const viewport = document.getElementById('treeViewport');
    if (!viewport || viewport.querySelector(':scope > .tree-canvas-surface')) return;
    const surface = document.createElement('div');
    surface.className = 'tree-canvas-surface';
    while (viewport.firstChild) surface.appendChild(viewport.firstChild);
    viewport.appendChild(surface);
  }

  function setupTreePan(){
    const viewport = document.getElementById('treeViewport');
    if (!viewport || viewport.dataset.panReady === '1') return;
    viewport.dataset.panReady = '1';

    viewport.addEventListener('wheel', (event) => {
      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        viewport.scrollLeft += event.deltaX || event.deltaY;
        event.preventDefault();
      }
    }, { passive:false });

    let dragging = false;
    let pointerId = null;
    let originX = 0;
    let originY = 0;
    let originLeft = 0;
    let originTop = 0;

    viewport.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('.tree-node, button, a, input, select')) return;
      dragging = true;
      pointerId = event.pointerId;
      originX = event.clientX;
      originY = event.clientY;
      originLeft = viewport.scrollLeft;
      originTop = viewport.scrollTop;
      viewport.classList.add('is-panning');
      viewport.setPointerCapture?.(pointerId);
    });
    viewport.addEventListener('pointermove', (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      viewport.scrollLeft = originLeft - (event.clientX - originX);
      viewport.scrollTop = originTop - (event.clientY - originY);
    });
    function finish(event){
      if (!dragging || (event && event.pointerId !== pointerId)) return;
      dragging = false;
      viewport.classList.remove('is-panning');
      try { viewport.releasePointerCapture?.(pointerId); } catch (err) {}
      pointerId = null;
    }
    viewport.addEventListener('pointerup', finish);
    viewport.addEventListener('pointercancel', finish);
  }

  function boot(){
    setupTreeSurface();
    setupTreePan();
  }

  window.__ZLTX_OPERATOR_CONSOLE_RUNTIME__ = { setupTreeSurface, setupTreePan };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
