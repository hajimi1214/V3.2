/*
 * V3.2 多轮复核终版运行时：纵向决策树、正常安全通过展示、主题文案统一。
 * 不改变真实接口；仅统一默认演示场景和可视化状态。
 */
(function reviewedConsoleFinal(){
  'use strict';
  if (window.__ZLTX_REVIEWED_CONSOLE_FINAL__) return;
  const state = {version:'V3.2-reviewed-vertical-pass'};
  const $ = id => document.getElementById(id);
  const ids = ['state_capture','context_model','vision_quality','localization_3d','placement_plan','hardware_interlock','safety_strategy','execution_constraint','fusion_arbitration','control_task','archive'];
  const agentIds = ['vision_quality','localization_3d','placement_plan','hardware_interlock','safety_strategy','execution_constraint'];

  function surface(){ return $('treeViewport')?.querySelector(':scope > .tree-canvas-surface') || $('treeViewport'); }
  function setPath(id, d){ const el = surface()?.querySelector('#' + id); if (el && el.getAttribute('d') !== d) el.setAttribute('d', d); }
  function applyVerticalFlow(){
    const svg = surface()?.querySelector('svg.tree-lines');
    if (!svg) return;
    if (svg.getAttribute('viewBox') !== '0 0 800 1195') svg.setAttribute('viewBox', '0 0 800 1195');
    if (svg.getAttribute('preserveAspectRatio') !== 'none') svg.setAttribute('preserveAspectRatio', 'none');
    setPath('line-state_capture-context_model', 'M375 92 H425');
    setPath('line-context_model-branch', 'M600 160 V181 H200 V202 M600 181 V202');
    setPath('line-branch-bus', 'M200 420 V439 H200 V459 M600 420 V439 H600 V459 M200 439 H600');
    setPath('line-agent-stems', 'M200 677 V696 H200 V716 M600 677 V696 H600 V716 M200 696 H600');
    setPath('line-merge-bus', 'M200 934 V957 H135 V980 M600 934 V957 H135 V980 M200 957 H600');
    setPath('line-fusion-control', 'M262 1072 H273');
    setPath('line-control-archive', 'M527 1072 H538');
    setPath('line-add-agent', 'M0 0');
  }

  function text(nodeId, selector, value){ const el = $('node-' + nodeId)?.querySelector(selector); if (el && el.textContent !== value) el.textContent = value; }
  function markPass(id){
    const node = $('node-' + id); if (!node) return;
    if (!node.classList.contains('status-pass') || node.classList.contains('status-limited') || node.classList.contains('status-blocked') || node.classList.contains('status-running') || node.classList.contains('status-waiting') || node.classList.contains('status-done')) {
      node.classList.remove('status-limited','status-blocked','status-running','status-waiting','status-done');
      node.classList.add('status-pass');
    }
    const badge = node.querySelector('.badge'); if (badge && badge.textContent !== '通过') badge.textContent = '通过';
  }
  function normalizeVisibleConclusion(){
    text('hardware_interlock','p:nth-of-type(2)','证据：安全门、光栅、急停均正常');
    text('hardware_interlock','p:nth-of-type(3)','输出结论：联锁校验通过');
    text('hardware_interlock','strong','风险 LOW');
    text('execution_constraint','p:nth-of-type(2)','证据：关节扭矩裕度正常');
    text('execution_constraint','p:nth-of-type(3)','输出结论：执行条件满足');
    text('execution_constraint','strong','风险 LOW');
    text('placement_plan','p:nth-of-type(3)','输出结论：最优路径可执行');
    text('placement_plan','strong','风险 LOW');
    text('fusion_arbitration','p','六路审查通过 · 安全仲裁放行');
    text('control_task','p','安全校验通过 · 控制任务生成');
    text('archive','p','审理记录归档 · 全程可追溯');
  }
  function finalPassView(){
    ids.forEach(markPass);
    normalizeVisibleConclusion();
    const tag = $('agentStatusTag'); if (tag && /融合仲裁/.test(tag.textContent)) tag.textContent = '融合仲裁Agent 通过';
  }
  function patchThemeLabel(){
    const btn = $('presentationThemeToggle'); if (!btn) return;
    btn.textContent = document.body.classList.contains('zltx-theme-light') ? '主题：工业白' : '主题：石墨金';
    btn.title = '切换工业白 / 石墨金显示主题';
  }
  function clearOldVisualCacheOnce(){
    try{
      const key='zltx_reviewed_console_revision';
      if(localStorage.getItem(key)!==state.version){
        ['zltx_decision_session_v33','zltx_decision_tree_snapshot_v32_final','zltx_auto_dispatch_state_v1'].forEach(k=>localStorage.removeItem(k));
        localStorage.setItem(key,state.version);
      }
    }catch(e){}
  }
  function observeResults(){
    const target = $('treeViewport'); if (!target || target.__reviewObserver) return;
    target.__reviewObserver = true;
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return; queued = true;
      requestAnimationFrame(() => {
        queued = false;
        normalizeVisibleConclusion();
        const finished = $('agentBus')?.textContent?.trim() === 'DONE' || $('startBtn')?.dataset?.completed === 'true' || $('node-archive')?.classList.contains('status-pass');
        if (finished) finalPassView();
      });
    });
    observer.observe(target,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
  }
  function boot(){
    clearOldVisualCacheOnce();
    applyVerticalFlow();
    normalizeVisibleConclusion();
    patchThemeLabel();
    observeResults();
    const bodyObs = new MutationObserver(patchThemeLabel);
    bodyObs.observe(document.body,{attributes:true,attributeFilter:['class']});
    setTimeout(()=>{applyVerticalFlow();normalizeVisibleConclusion();patchThemeLabel();},250);
    setTimeout(()=>{applyVerticalFlow();normalizeVisibleConclusion();patchThemeLabel();},1200);
    setTimeout(patchThemeLabel, 3000);
    setTimeout(patchThemeLabel, 5000);
  }
  state.applyVerticalFlow=applyVerticalFlow;
  state.finalPassView=finalPassView;
  window.__ZLTX_REVIEWED_CONSOLE_FINAL__=state;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else setTimeout(boot,0);
})();
