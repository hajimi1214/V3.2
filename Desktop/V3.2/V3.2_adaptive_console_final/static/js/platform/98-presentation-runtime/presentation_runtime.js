/**
 * 展示主题运行层：仅负责两套工业界面主题切换。
 * 下发动作仍使用页面中可见的标准控制按钮及原有安全校验流程。
 */
(function presentationThemeRuntime(){
  'use strict';
  if (window.__ZLTX_PRESENTATION_RUNTIME__) return;

  const THEME_KEY = 'zltx_presentation_theme_v2';
  const VALID_THEMES = new Set(['gold', 'light']);

  function applyTheme(theme){
    const next = VALID_THEMES.has(theme) ? theme : 'light';
    document.body.classList.toggle('zltx-theme-gold', next === 'gold');
    document.body.classList.toggle('zltx-theme-light', next === 'light');
    try { localStorage.setItem(THEME_KEY, next); } catch (err) {}

    const button = document.getElementById('presentationThemeToggle');
    if (button) {
      button.textContent = next === 'gold' ? '主题：石墨金' : '主题：工业白';
      button.setAttribute('aria-label', next === 'gold' ? '切换到工业白主题' : '切换到石墨金主题');
    }
    return next;
  }

  function getTheme(){
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return VALID_THEMES.has(saved) ? saved : 'light';
    } catch (err) {
      return 'light';
    }
  }

  function toggleTheme(){
    return applyTheme(document.body.classList.contains('zltx-theme-gold') ? 'light' : 'gold');
  }

  function mountThemeToggle(){
    const strip = document.querySelector('.metric-strip.action-only');
    if (!strip || document.getElementById('presentationThemeToggle')) {
      applyTheme(getTheme());
      return;
    }

    const button = document.createElement('button');
    button.id = 'presentationThemeToggle';
    button.type = 'button';
    button.className = 'presentation-theme-toggle';
    button.addEventListener('click', toggleTheme);
    strip.appendChild(button);
    applyTheme(getTheme());
  }

  function boot(){
    mountThemeToggle();
    applyTheme(getTheme());
  }

  window.__ZLTX_PRESENTATION_RUNTIME__ = { applyTheme, toggleTheme, mountThemeToggle };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
