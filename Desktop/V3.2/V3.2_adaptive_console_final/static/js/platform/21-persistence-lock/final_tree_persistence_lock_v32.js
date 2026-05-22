/*
 * V3.2 决策树最终持久化锁
 * 目标：
 * 1. 决策完成后，刷新/切页/进入“多Agent决策树”均保持同一棵树；
 * 2. 路由切换只改变展示比例，不允许重建空树；
 * 3. 只有用户主动“清理决策/清空画布”或重新启动新决策时，才允许重置树图。
 */
(function installFinalTreePersistenceLockV32(){
  const SESSION_KEY = 'zltx_decision_session_v33';
  const SNAPSHOT_KEY = 'zltx_decision_tree_dom_snapshot_v32';
  const SNAPSHOT_VERSION = 'V3.2';
  const EXPLICIT_CLEAR_ACTIONS = new Set(['clear-canvas']);
  const LOCKED_ROUTES = new Set(['workbench', 'tree-panel', 'agent-review', 'archive', 'trace']);
  let restoring = false;
  let mutingObserver = false;
  let routeGuardDepth = 0;
  let explicitClearUntil = 0;
  let lastSnapshotAt = 0;
  let observer = null;

  function nowMs(){ return Date.now(); }
  function safeJson(raw, fallback=null){
    try{ return JSON.parse(raw || 'null') ?? fallback; }
    catch(err){ return fallback; }
  }
  function readSession(){
    try{ return safeJson(localStorage.getItem(SESSION_KEY), null); }
    catch(err){ return null; }
  }
  function readSnapshot(){
    try{ return safeJson(localStorage.getItem(SNAPSHOT_KEY), null); }
    catch(err){ return null; }
  }
  function writeSnapshot(snapshot){
    try{ localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)); }
    catch(err){ console.warn('V3.2 决策树快照写入失败', err); }
  }
  function removeSnapshot(){
    try{ localStorage.removeItem(SNAPSHOT_KEY); }
    catch(err){}
  }
  function decisionSessionIsMeaningful(session=readSession()){
    if(!session || typeof session !== 'object') return false;
    const revealed = Array.isArray(session.revealed_nodes) ? session.revealed_nodes.length : 0;
    const statusCount = session.node_status && typeof session.node_status === 'object' ? Object.keys(session.node_status).length : 0;
    const bus = String(session.bus_state || '').trim();
    const task = String(session.task_json || '').trim();
    return Boolean(session.decision_started)
      || Boolean(session.start_completed)
      || revealed > 1
      || statusCount > 1
      || /DONE|RUNNING|完成|运行中/u.test(bus)
      || (task && !/WAITING_FOR_DECISION|WAIT_DEVICE_OR_REVIEW|"status"\s*:\s*"EMPTY"/u.test(task));
  }
  function snapshotIsMeaningful(snapshot=readSnapshot()){
    return Boolean(snapshot && snapshot.version === SNAPSHOT_VERSION && snapshot.viewport_html && snapshot.meaningful);
  }
  function hasPersistedTree(){
    return decisionSessionIsMeaningful() || snapshotIsMeaningful();
  }
  function clearAllowed(force=false){
    return Boolean(force) || nowMs() < explicitClearUntil || Boolean(window.__zltxAllowTreeResetForNewDecision);
  }
  function treeViewport(){ return document.getElementById('treeViewport'); }
  function toolbar(){ return document.querySelector('#tree-panel .workflow-canvas-toolbar'); }
  function activeRouteName(){
    const body = document.body;
    if(body?.classList.contains('platform_nav-tree-page')) return 'tree-panel';
    if(body?.classList.contains('platform_nav-page-open')) return document.querySelector('.nav-item.active,.nav-subitem.active')?.getAttribute('href')?.slice(1) || 'module';
    return 'workbench';
  }
  function sanitizeSnapshotHtml(html){
    // 决策树内部不应包含脚本；这里只接受普通展示 DOM。
    return String(html || '').replace(/<script[\s\S]*?<\/script>/giu, '');
  }
  function canvasSemanticState(){
    const vp = treeViewport();
    if(!vp) return {visibleNodeCount:0, revealed:[], statusText:''};
    const nodes = Array.from(vp.querySelectorAll('.tree-node[data-node]'));
    const revealed = nodes.filter(node => !node.classList.contains('future-node') && !node.classList.contains('workflow-node-hidden'));
    const statusText = revealed.map(node => node.querySelector('.badge')?.textContent?.trim() || '').join('|');
    return {visibleNodeCount: revealed.length, revealed: revealed.map(node => node.dataset.node).filter(Boolean), statusText};
  }
  function captureTreeSnapshot(reason='capture'){
    if(restoring || mutingObserver) return null;
    const vp = treeViewport();
    if(!vp) return null;
    const session = readSession();
    const semantic = canvasSemanticState();
    // 初始页面模板里可能自带单个占位节点与演示性 badge；
    // 不允许仅凭一个节点或一个 badge 就把“尚未决策”的页面误存为有效树。
    const meaningful = decisionSessionIsMeaningful(session) || semantic.visibleNodeCount > 1;
    if(!meaningful) return null;
    const snapshot = {
      version: SNAPSHOT_VERSION,
      saved_at: new Date().toISOString(),
      reason,
      meaningful: true,
      viewport_html: sanitizeSnapshotHtml(vp.innerHTML),
      viewport_class: vp.className,
      viewport_style: vp.getAttribute('style') || '',
      scroll_left: Number(vp.scrollLeft || 0),
      scroll_top: Number(vp.scrollTop || 0),
      body_class_hint: document.body?.className || '',
      focus_label: document.getElementById('focusLabel')?.textContent?.trim() || '',
      semantic,
    };
    writeSnapshot(snapshot);
    lastSnapshotAt = nowMs();
    document.body && (document.body.dataset.treeSnapshotState = 'saved');
    return snapshot;
  }
  function rebindRestoredTree(vp){
    try{
      vp.querySelectorAll('.tree-node').forEach(node => {
        try{ typeof attachNodeEnableToggle === 'function' && attachNodeEnableToggle(node); }catch(err){}
        try{ typeof makeNodeDraggable === 'function' && makeNodeDraggable(node); }catch(err){}
      });
    }catch(err){}
    try{ typeof localizeVisibleStatuses === 'function' && localizeVisibleStatuses(); }catch(err){}
    try{ typeof redrawFlowCanvas === 'function' && redrawFlowCanvas(); }catch(err){}
  }
  function restoreTreeSnapshot(reason='restore'){
    const snapshot = readSnapshot();
    const vp = treeViewport();
    if(!vp || !snapshotIsMeaningful(snapshot)) return false;
    if(restoring) return true;
    restoring = true;
    mutingObserver = true;
    try{
      vp.innerHTML = sanitizeSnapshotHtml(snapshot.viewport_html);
      if(snapshot.viewport_class) vp.className = snapshot.viewport_class;
      if(snapshot.viewport_style) vp.setAttribute('style', snapshot.viewport_style);
      else vp.removeAttribute('style');
      const focus = document.getElementById('focusLabel');
      if(focus && snapshot.focus_label) focus.textContent = snapshot.focus_label;
      document.body?.classList.remove('empty-workflow-flow','no-device-execution-flow');
      document.body?.classList.add('compact-workflow-flow','execution-step-flow');
      requestAnimationFrame(() => {
        try{ vp.scrollLeft = Number(snapshot.scroll_left || 0); vp.scrollTop = Number(snapshot.scroll_top || 0); }catch(err){}
        rebindRestoredTree(vp);
        document.body && (document.body.dataset.treeSnapshotState = `restored-${reason}`);
        mutingObserver = false;
        restoring = false;
      });
      return true;
    }catch(err){
      console.warn('V3.2 决策树快照恢复失败', err);
      mutingObserver = false;
      restoring = false;
      return false;
    }
  }
  function guardTreeReset(name, original){
    return function guardedTreeReset(force=false){
      if(!clearAllowed(force) && hasPersistedTree()){
        restoreTreeSnapshot(`${name}-blocked`);
        return false;
      }
      return typeof original === 'function' ? original.apply(this, arguments) : undefined;
    };
  }
  function guardTopologyPrepare(name, original){
    return function guardedTopologyPrepare(){
      if(!clearAllowed(false) && routeGuardDepth > 0 && hasPersistedTree()){
        restoreTreeSnapshot(`${name}-route-locked`);
        return true;
      }
      return typeof original === 'function' ? original.apply(this, arguments) : undefined;
    };
  }
  function installFunctionGuards(){
    if(window.__zltxFinalTreePersistenceGuardsInstalled) return;
    window.__zltxFinalTreePersistenceGuardsInstalled = true;
    window.emptyDecisionCanvas = guardTreeReset('emptyDecisionCanvas', window.emptyDecisionCanvas);
    window.clearDecisionTreeForNoDevice = guardTreeReset('clearDecisionTreeForNoDevice', window.clearDecisionTreeForNoDevice);
    window.setEmptyManualCanvas = guardTreeReset('setEmptyManualCanvas', window.setEmptyManualCanvas);
    window.prepareInitialTree = guardTreeReset('prepareInitialTree', window.prepareInitialTree);
    window.prepareDeviceGatedStepTopology = guardTopologyPrepare('prepareDeviceGatedStepTopology', window.prepareDeviceGatedStepTopology);
    window.setupDefaultTopologyForRun = guardTopologyPrepare('setupDefaultTopologyForRun', window.setupDefaultTopologyForRun);
  }
  function wrapDecisionStarts(){
    if(window.__zltxFinalTreeDecisionStartsWrapped) return;
    window.__zltxFinalTreeDecisionStartsWrapped = true;
    const originalStartCanvasDecision = typeof window.startCanvasDecision === 'function' ? window.startCanvasDecision : null;
    if(originalStartCanvasDecision){
      window.startCanvasDecision = async function wrappedStartCanvasDecision(){
        window.__zltxAllowTreeResetForNewDecision = true;
        try{ return await originalStartCanvasDecision.apply(this, arguments); }
        finally{
          window.__zltxAllowTreeResetForNewDecision = false;
          captureTreeSnapshot('decision-finish');
        }
      };
    }
    const originalStartDecision = typeof window.startDecision === 'function' ? window.startDecision : null;
    if(originalStartDecision){
      window.startDecision = function wrappedStartDecision(){
        window.__zltxAllowTreeResetForNewDecision = true;
        const ret = originalStartDecision.apply(this, arguments);
        Promise.resolve(ret).finally(() => {
          window.__zltxAllowTreeResetForNewDecision = false;
          captureTreeSnapshot('startDecision-finish');
        });
        return ret;
      };
    }
  }
  function wrapRoute(){
    if(window.__zltxFinalTreeRouteWrapped) return;
    const originalRouteToModule = typeof window.routeToModule === 'function' ? window.routeToModule : null;
    if(!originalRouteToModule) return;
    window.__zltxFinalTreeRouteWrapped = true;
    window.routeToModule = function wrappedRouteToModule(targetId='workbench', title){
      const shouldLock = LOCKED_ROUTES.has(String(targetId)) && hasPersistedTree();
      if(shouldLock) routeGuardDepth += 1;
      try{
        const ret = originalRouteToModule.apply(this, arguments);
        if(shouldLock){
          restoreTreeSnapshot(`route-${targetId}-immediate`);
          [0, 80, 240].forEach(ms => setTimeout(() => restoreTreeSnapshot(`route-${targetId}-${ms}`), ms));
        }
        return ret;
      } finally {
        if(shouldLock) setTimeout(() => { routeGuardDepth = Math.max(0, routeGuardDepth - 1); }, 260);
      }
    };
  }
  function patchClearActions(){
    document.addEventListener('click', (event) => {
      const clearDecision = event.target.closest('#clearDecisionBtn');
      const flowAction = event.target.closest('[data-flow-action]')?.dataset.flowAction;
      if(clearDecision || EXPLICIT_CLEAR_ACTIONS.has(String(flowAction || ''))){
        explicitClearUntil = nowMs() + 1600;
        removeSnapshot();
      }
    }, true);
  }
  function hookPersistDecisionSession(){
    if(window.__zltxFinalPersistWrapped) return;
    const originalPersist = typeof window.persistDecisionSession === 'function' ? window.persistDecisionSession : null;
    if(!originalPersist) return;
    window.__zltxFinalPersistWrapped = true;
    window.persistDecisionSession = function wrappedPersistDecisionSession(){
      const ret = originalPersist.apply(this, arguments);
      const eventType = String(arguments?.[0]?.type || 'persist');
      if(!/CLEAR|DELETE/u.test(eventType)){
        captureTreeSnapshot(`persist-${eventType}`);
      }
      return ret;
    };
  }
  function installMutationWatch(){
    const vp = treeViewport();
    if(!vp || observer) return;
    observer = new MutationObserver(() => {
      if(mutingObserver || restoring) return;
      if(!hasPersistedTree()) return;
      const semantic = canvasSemanticState();
      if(semantic.visibleNodeCount <= 1 && snapshotIsMeaningful()){
        restoreTreeSnapshot('observer-prevent-empty');
        return;
      }
      if(nowMs() - lastSnapshotAt > 180){
        captureTreeSnapshot('observer-update');
      }
    });
    observer.observe(vp, {subtree:true, childList:true, attributes:true, characterData:true});
  }
  function bootRestore(){
    installFunctionGuards();
    hookPersistDecisionSession();
    wrapDecisionStarts();
    wrapRoute();
    patchClearActions();
    installMutationWatch();
    if(snapshotIsMeaningful()){
      [0, 120, 420, 900].forEach(ms => setTimeout(() => restoreTreeSnapshot(`boot-${ms}`), ms));
    } else if(decisionSessionIsMeaningful()) {
      // 若旧会话没有 DOM 快照，先让原有恢复逻辑完成，再生成第一份快照。
      [480, 980, 1480].forEach(ms => setTimeout(() => {
        try{ typeof window.restoreDecisionSession === 'function' && window.restoreDecisionSession(); }catch(err){}
        captureTreeSnapshot(`bootstrap-from-session-${ms}`);
      }, ms));
    }
  }
  document.addEventListener('DOMContentLoaded', bootRestore);
  window.addEventListener('pageshow', () => {
    installFunctionGuards();
    hookPersistDecisionSession();
    wrapDecisionStarts();
    wrapRoute();
    if(snapshotIsMeaningful()) restoreTreeSnapshot('pageshow');
  });
  window.addEventListener('beforeunload', () => captureTreeSnapshot('beforeunload'));
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible' && snapshotIsMeaningful()) restoreTreeSnapshot('visibility');
  });
})();
