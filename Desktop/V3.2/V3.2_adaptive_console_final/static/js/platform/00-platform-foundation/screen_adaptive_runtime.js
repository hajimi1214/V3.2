/*
 * V3.2 自动响应式适配运行时：
 * 1. 不再缩放整个页面根容器；
 * 2. 仅根据可视区宽高写入密度标签，CSS 负责响应式重排；
 * 3. 不再设置 --platform-scale / --platform-width / --platform-height；
 * 4. 保留兼容事件，便于决策树和标题在 resize 后重绘。
 */
(function(){
  const ROOT = document.documentElement;

  function chooseDensity(width, height){
    if(width >= 1920 && height >= 1000) return 'presentation';
    if(width <= 1480 || height <= 820) return 'compact';
    return 'standard';
  }

  function applyResponsiveMode(){
    const width = Math.max(960, window.innerWidth || document.documentElement.clientWidth || 1680);
    const height = Math.max(640, window.innerHeight || document.documentElement.clientHeight || 945);
    const density = chooseDensity(width, height);

    ROOT.dataset.displayMode = 'auto';
    ROOT.dataset.autoDensity = density;
    ROOT.style.setProperty('--viewport-width', `${width}px`);
    ROOT.style.setProperty('--viewport-height', `${height}px`);
    ROOT.style.removeProperty('--platform-scale');
    ROOT.style.removeProperty('--platform-width');
    ROOT.style.removeProperty('--platform-height');
    ROOT.style.removeProperty('--platform-display-factor');
    ROOT.style.removeProperty('--platform-density-factor');

    try{
      const detail = { mode:'auto', density, width, height, strategy:'css-responsive-only' };
      window.dispatchEvent(new CustomEvent('zltx:auto-display-adapted', { detail }));
      window.dispatchEvent(new CustomEvent('zltx:display-adapted', { detail }));
    }catch(err){}
  }

  // Compatibility hooks: historical callers can still invoke them, but no scaling is applied.
  window.zltxSetDisplayMode = function(){ applyResponsiveMode(); return 'auto'; };
  window.zltxGetDisplayMode = function(){ return 'auto'; };
  window.zltxFitPlatformScreen = applyResponsiveMode;

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(applyResponsiveMode, 88);
  });
  document.addEventListener('DOMContentLoaded', applyResponsiveMode);
  applyResponsiveMode();
})();
