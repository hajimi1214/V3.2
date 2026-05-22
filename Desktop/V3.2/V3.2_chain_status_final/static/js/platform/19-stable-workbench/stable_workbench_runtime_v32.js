/*
 * V3.2 稳定工作台运行时。
 * 目标：不引入高频观察器，不重复包裹路由；只做轻量状态恢复和布局收口。
 */
(function(){
  const SESSION_KEY = 'zltx_decision_session_v33';
  function readSession(){
    try{ return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch(err){ return null; }
  }
  function hasDecision(){
    const session = readSession();
    if(!session || typeof session !== 'object') return false;
    const revealed = Array.isArray(session.revealed_nodes) ? session.revealed_nodes.length : 0;
    const statuses = session.node_status && typeof session.node_status === 'object' ? Object.keys(session.node_status).length : 0;
    const bus = String(session.bus_state || '');
    const task = String(session.task_json || '');
    return Boolean(session.decision_started)
      || Boolean(session.start_completed)
      || revealed > 1
      || statuses > 1
      || /DONE|RUNNING|完成|运行中/u.test(bus)
      || (task && !/WAITING_FOR_DECISION|WAIT_DEVICE_OR_REVIEW|"status"\s*:\s*"EMPTY"/u.test(task));
  }
  function safe(fn, ...args){
    try{ return typeof fn === 'function' ? fn(...args) : undefined; }
    catch(err){ console.warn('V3.2 稳定工作台恢复失败', err); return undefined; }
  }
  function restoreOnce(reason){
    document.body.classList.remove('tree-audit-dock','detached-log-dock');
    document.querySelectorAll('.tree-audit-dock,.decision-audit-rail,.route-side-panel,.module-detail-side,.module-agent-mini').forEach(node => {
      if(node.id !== 'tree-panel' && node.id !== 'decision-runtime-console') node.remove();
    });
    if(hasDecision()){
      safe(window.restoreDecisionSession);
      safe(window.redrawFlowCanvas);
      safe(window.syncAgentReviewMirror);
    }
    document.body.dataset.stableWorkbenchRestore = String(reason || 'ready');
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('stable-workbench-v32');
    window.setTimeout(() => restoreOnce('boot'), 980);
  });
  window.addEventListener('pageshow', () => window.setTimeout(() => restoreOnce('pageshow'), 220));
  window.addEventListener('resize', () => {
    window.clearTimeout(window.__zltxStableResizeTimer);
    window.__zltxStableResizeTimer = window.setTimeout(() => safe(window.redrawFlowCanvas), 160);
  });
})();
