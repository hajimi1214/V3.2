/*
 * 页面屏幕自适应模块。
 * 根据当前电脑屏幕大小自动缩放平台主界面。
 */
(function(){
  const DESIGN_WIDTH = 1600;
  const DESIGN_HEIGHT = 900;
  const MIN_SCALE = 0.72;
  const MAX_SCALE = 1.12;

  function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
  }

  function fitPlatformScreen(){
    const scale = clamp(
      Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT),
      MIN_SCALE,
      MAX_SCALE
    );

    document.documentElement.style.setProperty("--platform-scale", scale.toFixed(4));
    document.documentElement.style.setProperty("--platform-width", `${window.innerWidth / scale}px`);
    document.documentElement.style.setProperty("--platform-height", `${window.innerHeight / scale}px`);
  }

  window.addEventListener("resize", fitPlatformScreen);
  document.addEventListener("DOMContentLoaded", fitPlatformScreen);
  fitPlatformScreen();
})();