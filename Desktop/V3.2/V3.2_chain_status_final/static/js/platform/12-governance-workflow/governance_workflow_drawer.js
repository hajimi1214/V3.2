const GOVERNANCE_WORKFLOW_AGENTS = [
  {id:'governance_propose_agent', name:'工业规范治理提案Agent', layer:'工业规范治理规划层', role:'根据需求生成proposal/design/tasks/specs变更提案', icon:'P', risk:'LOW', latency:72, status:'PASS', input:'需求描述 / 变更名', evidence:'GOVERNANCE_PROPOSE', output:'完整变更提案'},
  {id:'governance_explore_agent', name:'工业规范治理探索Agent', layer:'工业规范治理规划层', role:'只读取代码和规范进行调研，不直接改代码', icon:'E', risk:'LOW', latency:88, status:'PASS', input:'待探索主题', evidence:'GOVERNANCE_EXPLORE', output:'技术方案与风险判断'},
  {id:'governance_apply_agent', name:'工业规范治理实现Agent', layer:'工业规范治理实现层', role:'按tasks.md逐项实现代码并标记完成状态', icon:'A', risk:'MEDIUM', latency:126, status:'PASS', input:'tasks.md / design.md', evidence:'GOVERNANCE_APPLY_TASKS', output:'代码实现与任务勾选'},
  {id:'governance_verify_agent', name:'工业规范治理审计Agent', layer:'工业规范治理审计层', role:'从完整性、正确性、一致性三个维度审计实现质量', icon:'V', risk:'LOW', latency:112, status:'PASS', input:'实现代码 / spec / tasks', evidence:'GOVERNANCE_VERIFY_3D', output:'审计结论和警告项'},
  {id:'governance_sync_agent', name:'工业规范治理规范同步Agent', layer:'工业规范治理归档层', role:'把delta spec提前同步到主规范，让并行Agent共享最新规范', icon:'S', risk:'LOW', latency:84, status:'PASS', input:'changes/*/specs', evidence:'GOVERNANCE_SYNC_DELTA', output:'主规范同步结果'},
  {id:'governance_archive_agent', name:'工业规范治理归档Agent', layer:'工业规范治理归档层', role:'检查artifact和tasks完成状态并归档变更', icon:'R', risk:'LOW', latency:92, status:'PASS', input:'已完成变更', evidence:'GOVERNANCE_ARCHIVE_READY', output:'archive/YYYY-MM-DD-change'},
  {id:'governance_bulk_archive_agent', name:'工业规范治理批量归档Agent', layer:'工业规范治理归档层', role:'多Agent并行开发后批量归档多个变更并处理spec冲突', icon:'B', risk:'MEDIUM', latency:140, status:'PASS', input:'多个活跃变更', evidence:'GOVERNANCE_BULK_ARCHIVE', output:'按时间顺序合并归档'}
];
const GOVERNANCE_WORKFLOW_COMMANDS = [
  ['propose','/opsx-propose','规划','一键生成完整变更提案'],
  ['explore','/opsx-explore','规划','探索式思考，不写代码'],
  ['new','/opsx-new','规划','创建空白变更脚手架'],
  ['continue','/opsx-continue','规划','逐步创建下一个 artifact'],
  ['ff','/opsx-ff','规划','一键快进生成所有规划文档'],
  ['apply','/opsx-apply','实现','按 tasks.md 逐项写代码'],
  ['verify','/opsx-verify','审计','从完整性、正确性、一致性三维度审计'],
  ['sync','/opsx-sync','归档','提前同步 delta spec 到主规范'],
  ['archive','/opsx-archive','归档','归档单个已完成变更'],
  ['bulk-archive','/opsx-bulk-archive','归档','批量归档多个并行变更'],
  ['onboard','/opsx-onboard','学习','交互式教程，带你走一遍完整流程']
];

function injectGovernanceAgents(){
  if(typeof AGENT_CATALOG === 'undefined') return;
  GOVERNANCE_WORKFLOW_AGENTS.forEach(agent => {
    if(!AGENT_CATALOG.some(x => x.id === agent.id)) AGENT_CATALOG.push({...agent});
    if(typeof FLOW_NODE_META !== 'undefined') FLOW_NODE_META[agent.id] = {...agent};
  });
}
function ensureAgentLibraryBackdrop(){
  if(document.getElementById('agentLibraryBackdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.id = 'agentLibraryBackdrop';
  backdrop.dataset.noOverlay = 'true';
  backdrop.addEventListener('click', () => closeAgentLibrary());
  document.body.appendChild(backdrop);
}
function isAgentLibraryOpen(){
  return Boolean(document.getElementById('flowAgentLibrary')?.classList.contains('open'));
}
function syncAgentLibraryOpenState(){
  document.body.classList.toggle('agent-library-open', isAgentLibraryOpen());
}
function openAgentLibrary(){
  ensureAgentLibraryBackdrop();
  const lib = document.getElementById('flowAgentLibrary');
  if(lib){
    lib.classList.add('open');
    lib.classList.remove('library-minimized');
    syncAgentLibraryOpenState();
  }
}
function closeAgentLibrary(){
  const lib = document.getElementById('flowAgentLibrary');
  if(lib) lib.classList.remove('open','library-minimized');
  syncAgentLibraryOpenState();
}
function ensureGovernanceLibrarySection(){
  injectGovernanceAgents();
  const lib = document.getElementById('flowAgentLibrary');
  if(!lib) return;
  let section = lib.querySelector('[data-lib="governance-workflows"]');
  if(!section){
    const wrap = document.createElement('div');
    wrap.className = 'agent-lib-section governance-agent-section';
    wrap.innerHTML = '<h4>工业规范治理工作流Agent</h4><div class="agent-lib-list" data-lib="governance-workflows"></div>';
    const imported = lib.querySelector('.imported-model-section');
    if(imported) imported.insertAdjacentElement('beforebegin', wrap);
    else lib.appendChild(wrap);
    section = wrap.querySelector('[data-lib="governance-workflows"]');
  }
  section.innerHTML = '';
  GOVERNANCE_WORKFLOW_AGENTS.forEach(agent => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.addAgentId = agent.id;
    btn.innerHTML = `<span>${escapeHtml(agent.icon)}</span><b>${escapeHtml(agent.name)}</b><small>${escapeHtml(agent.layer)} · ${escapeHtml(agent.role)}</small>`;
    section.appendChild(btn);
  });
}

function buildGovernanceWorkflowView(){
  const wrap = document.createElement('div');
  wrap.className = 'governance-workflow-view';
  const commands = GOVERNANCE_WORKFLOW_COMMANDS.map((cmd, idx) => `<article class="governance-command"><i>${String(idx+1).padStart(2,'0')}</i><div><b>${cmd[0]}</b><code>${cmd[1]}</code><p>${cmd[2]} · ${cmd[3]}</p></div></article>`).join('');
  const chips = GOVERNANCE_WORKFLOW_AGENTS.map(a => `<span class="governance-agent-chip">${escapeHtml(a.icon)} ${escapeHtml(a.name)}</span>`).join('');
  wrap.innerHTML = `
    <section class="governance-hero"><div><span>GOVERNANCE WORKFLOW CENTER</span><h3>工业规范治理工作流接入中心</h3><p>这里把你上传的工业规范治理技能手册转成平台模块：它解释Agent开发从哪里开始、如何规划、如何实现、如何审计、如何归档，也能把这些工作流作为Agent组件导入画布。</p></div><b>11 个技能 · 7 个工作流Agent</b></section>
    <section class="governance-layout">
      <article class="governance-card"><h4>技能命令总览</h4><div class="governance-command-list">${commands}</div></article>
      <article class="governance-card"><h4>推荐工程流程</h4><div class="governance-flow"><span>/opsx-propose</span><i></i><span>/opsx-apply</span><i></i><span>/opsx-verify</span><i></i><span>/opsx-archive</span></div><p class="governance-note">复杂变更可以用 /opsx-new + /opsx-continue 精细推进；多个Agent并行开发后可以用 /opsx-bulk-archive 批量归档并处理spec冲突。</p><h4>平台内可导入的工业规范治理 Agent</h4>${chips}<div class="governance-steps"><pre>安装：npm install -g @fission-ai/governance@latest
初始化：governance init --tools github-copilot
刷新：governance update
注意：不要使用 --tools all，避免生成大量无用隐藏目录。</pre><pre>示例变更：/opsx-propose improve-agent-workflow-canvas
实现：/opsx-apply improve-agent-workflow-canvas
审计：/opsx-verify improve-agent-workflow-canvas
归档：/opsx-archive improve-agent-workflow-canvas</pre></div></article>
    </section>`;
  setTimeout(refreshRuntimeDocsPanel, 80);
  return wrap;
}

function initGovernanceWorkflowNav(){
  if(document.querySelector('.nav-item[href="#governance-workflow"]')) return;
  const modelItem = document.querySelector('.nav-item[href="#model-import"]') || document.querySelector('.nav-item[href="#model-output"]');
  const a = document.createElement('a');
  a.className = 'nav-item';
  a.href = '#governance-workflow';
  a.innerHTML = '<span>▣</span><b>工业规范治理工作流</b>';
  if(modelItem) modelItem.insertAdjacentElement('afterend', a);
  else document.querySelector('.nav-list')?.appendChild(a);
}

const openModuleOverlayBeforeGovernanceWorkflow = typeof openModuleOverlay === 'function' ? openModuleOverlay : null;
if(openModuleOverlayBeforeGovernanceWorkflow){
  openModuleOverlay = function(targetId, title){
    if(targetId === 'governance-workflow'){
      const overlay = $('moduleOverlay');
      const content = $('overlayContent');
      const overlayTitle = $('overlayTitle');
      if(!overlay || !content || !overlayTitle) return;
      overlayTitle.textContent = title || '工业规范治理工作流接入中心';
      content.innerHTML = '';
      content.appendChild(buildGovernanceWorkflowView());
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden','false');
      return;
    }
    return openModuleOverlayBeforeGovernanceWorkflow(targetId, title);
  };
}

/* Wrap library refresh so 工业规范治理 section always exists and drawer state stays synced. */
const refreshAgentLibraryBeforeGovernanceWorkflow = typeof refreshAgentLibraryButtons === 'function' ? refreshAgentLibraryButtons : null;
if(refreshAgentLibraryBeforeGovernanceWorkflow){
  refreshAgentLibraryButtons = function(){
    injectGovernanceAgents();
    refreshAgentLibraryBeforeGovernanceWorkflow();
    ensureGovernanceLibrarySection();
    syncAgentLibraryOpenState();
  };
}

/* Use a new clean storage key for V3.2 canvas to avoid inheriting broken layouts. */
if(typeof MODEL_RUNTIME_FLOW_STORAGE_KEY !== 'undefined'){
  try{
    const oldRaw = localStorage.getItem(MODEL_RUNTIME_FLOW_STORAGE_KEY);
    const newKey = 'zltx_agent_workflow_canvas_no_overlap_governance';
    if(oldRaw && !localStorage.getItem(newKey)){
      // Do not auto-migrate broken node positions. Keep V3.2 clean by default.
      localStorage.removeItem(MODEL_RUNTIME_FLOW_STORAGE_KEY);
    }
  }catch(e){}
}

function applyPlatformVersionLabelsFromGovernanceWorkflow(){
  document.title = '智领铜行--人工智能机械臂多Agent智能决策平台 V3.2';
  document.querySelectorAll('.brand-ver').forEach(el => el.textContent = 'V3.2');
  const version = document.querySelector('.platform-card .pc-row:last-child strong');
  if(version) version.textContent = 'V3.2';
}

/* Make all library open/close actions deterministic and prevent transparent穿模. */
document.addEventListener('click', (e) => {
  const flowAction = e.target.closest('[data-flow-action]')?.dataset.flowAction;
  if(flowAction === 'add-agent'){
    setTimeout(() => { openAgentLibrary(); ensureGovernanceLibrarySection(); }, 0);
  }
  if(flowAction === 'close-agent-library'){
    setTimeout(closeAgentLibrary, 0);
  }
  if(flowAction === 'toggle-library-size'){
    e.preventDefault();
    e.stopPropagation();
    const lib = document.getElementById('flowAgentLibrary');
    if(lib) lib.classList.toggle('library-minimized');
    syncAgentLibraryOpenState();
  }
  if(e.target.closest('.nav-item[href="#governance-workflow"]')){
    e.preventDefault();
    openModuleOverlay('governance-workflow', '工业规范治理工作流接入中心');
  }
}, true);

document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') closeAgentLibrary();
});

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    applyPlatformVersionLabelsFromGovernanceWorkflow();
    initGovernanceWorkflowNav();
    injectGovernanceAgents();
    ensureAgentLibraryBackdrop();
    ensureGovernanceLibrarySection();
    refreshAgentLibraryButtons?.();
    syncAgentLibraryOpenState();
    if(typeof MODULE_DETAIL_META !== 'undefined'){
      MODULE_DETAIL_META['governance-workflow'] = {
        title:'工业规范治理工作流接入中心',
        tag:'GOVERNANCE WORKFLOW',
        desc:'展示工业规范治理安装、初始化、规划、实现、审计、归档流程，并把工作流技能注册成可拖入画布的Agent组件。',
        bullets:['propose/explore/new/continue/ff 负责规划','apply 负责按tasks实现','verify 负责完整性/正确性/一致性审计','archive/bulk-archive 负责单变更或多变更归档']
      };
    }
    const vp = getFlowViewport?.();
    if(vp){
      vp.classList.add('governance-canvas-contained');
      vp.scrollTo({left:0, top:0, behavior:'auto'});
      redrawFlowCanvas?.();
    }
  }, 900);
});


const AGENT_DRAWER_VERSION = 'V3.2';
function escapeAgentDrawerText(s){
  return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function getAgentDrawerCatalog(){
  try{ syncImportedAgentsToCatalog?.(); injectGovernanceAgents?.(); }catch(e){}
  const base = Array.isArray(window.AGENT_CATALOG) ? window.AGENT_CATALOG : (typeof AGENT_CATALOG !== 'undefined' ? AGENT_CATALOG : []);
  const seen = new Set();
  return base.filter(a => a && a.id && !seen.has(a.id) && seen.add(a.id));
}
function groupAgentDrawerCatalog(){
  const all = getAgentDrawerCatalog();
  const importedIds = new Set((typeof getImportedAgentModels === 'function' ? getImportedAgentModels() : []).map(x => x.id));
  const governanceIds = new Set((typeof GOVERNANCE_WORKFLOW_AGENTS !== 'undefined' ? GOVERNANCE_WORKFLOW_AGENTS : []).map(x => x.id));
  return {
    industrial: all.filter(a => !importedIds.has(a.id) && !governanceIds.has(a.id) && !(String(a.layer || '').includes('仲裁') || String(a.name || '').includes('仲裁'))),
    arbitration: all.filter(a => !importedIds.has(a.id) && !governanceIds.has(a.id) && (String(a.layer || '').includes('仲裁') || String(a.name || '').includes('仲裁'))),
    imported: all.filter(a => importedIds.has(a.id)),
    governance: all.filter(a => governanceIds.has(a.id))
  };
}
function agentDrawerCardHtml(agent){
  return `<button type="button" class="agent-component-card" data-add-agent-id="${escapeAgentDrawerText(agent.id)}"><i>${escapeAgentDrawerText(agent.icon || 'A')}</i><span><b>${escapeAgentDrawerText(agent.name || 'Agent')}</b><small>${escapeAgentDrawerText(agent.layer || 'Agent层')} · ${escapeAgentDrawerText(agent.role || agent.output || '参与多Agent决策')}</small><em>${escapeAgentDrawerText(agent.risk || 'LOW')} · ${Number(agent.latency || 80)}ms</em></span></button>`;
}
function agentDrawerSectionHtml(title, list, empty){
  return `<section class="v3_2-lib-section"><h4>${title}</h4><div class="v3_2-lib-grid">${list.length ? list.map(agentDrawerCardHtml).join('') : `<div class="v3_2-empty-lib">${empty}</div>`}</div></section>`;
}
function ensureAgentComponentDrawer(){
  let mask = document.getElementById('agentComponentDrawerMask');
  if(mask) return mask;
  mask = document.createElement('div');
  mask.id = 'agentComponentDrawerMask';
  mask.className = 'agent-component-drawer-mask';
  mask.dataset.noOverlay = 'true';
  mask.innerHTML = `<aside class="agent-component-drawer" role="dialog" aria-modal="true" aria-label="Agent组件库"><header class="agent-component-drawer-head"><div><span>AGENT COMPONENT LIBRARY</span><b>Agent与仲裁组件库</b></div><button type="button" data-agent-drawer-close>×</button></header><div class="agent-component-drawer-info">选择一个Agent后会加入当前画布。组件库是独立抽屉，不会再穿模、遮挡节点或底部面板；导入模型和工业规范治理工作流也会出现在这里。</div><main id="agentComponentDrawerBody" class="agent-component-drawer-body"></main></aside>`;
  mask.addEventListener('click', (e) => { if(e.target === mask || e.target.closest('[data-agent-drawer-close]')) closeAgentComponentDrawer(); });
  document.body.appendChild(mask);
  return mask;
}
function renderAgentComponentDrawer(){
  const mask = ensureAgentComponentDrawer();
  const body = mask.querySelector('#agentComponentDrawerBody');
  const g = groupAgentDrawerCatalog();
  body.innerHTML = [
    agentDrawerSectionHtml('工业专业Agent', g.industrial, '暂无工业Agent。'),
    agentDrawerSectionHtml('仲裁Agent / 仲裁组件', g.arbitration, '暂无仲裁组件。'),
    agentDrawerSectionHtml('已导入Agent模型', g.imported, '暂无导入模型，请从左侧“模型导入”登记。'),
    agentDrawerSectionHtml('工业规范治理工作流Agent', g.governance, '暂无工业规范治理工作流Agent。')
  ].join('');
}
function openAgentComponentDrawer(){
  renderAgentComponentDrawer();
  closeAgentLibrary?.();
  document.body.classList.remove('agent-library-open');
  document.body.classList.add('workflow-agent-library-open');
}
function closeAgentComponentDrawer(){
  document.body.classList.remove('workflow-agent-library-open');
}

document.addEventListener('click', function(e){
  const action = e.target.closest('[data-flow-action]')?.dataset.flowAction;
  if(action === 'add-agent'){
    e.preventDefault();
    e.stopPropagation();
    setTimeout(openAgentComponentDrawer, 20);
  }
}, true);

document.addEventListener('click', function(e){
  const add = e.target.closest('#agentComponentDrawerMask [data-add-agent-id]');
  if(!add) return;
  const id = add.dataset.addAgentId;
  try{ addAgentToCanvas?.(id); }catch(err){ console.warn('V3.2添加Agent失败', err); }
  closeAgentComponentDrawer();
  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener('keydown', function(e){
  if(e.key === 'Escape') closeAgentComponentDrawer();
});

function buildGovernanceWorkflowDetailView(){
  const wrap = buildGovernanceWorkflowView ? buildGovernanceWorkflowView() : document.createElement('div');
  wrap.classList.add('governance-real-view');
  const real = document.createElement('section');
  real.className = 'governance-real-ops';
  real.innerHTML = `
    <article><h4>治理说明文档的作用</h4><p>它不是机械臂算法，也不是直接替代现有Agent的模型。它是一个工程化工作流手册：把“需求、设计、实现、审计、归档”变成可追踪的工业规范治理流程，用来规范我们后续继续开发这个平台。</p><ul><li>propose：把需求生成变更提案。</li><li>apply：按任务清单写代码。</li><li>verify：检查完整性、正确性、一致性。</li><li>archive：把完成的变更归档。</li></ul></article>
    <article><h4>真实接入步骤</h4><pre>node --version
npm install -g @fission-ai/governance@latest
governance --version
cd 你的项目目录
governance init --tools github-copilot
governance update</pre><p>初始化后，VS Code 的 开发工具 中会出现 /opsx-* 命令。不要使用 --tools all，避免生成大量无用隐藏目录。</p></article>
    <article><h4>在本平台中的真实效果</h4><p>工业规范治理接入后不是“页面好看一点”，而是让每次迭代都有规范记录：</p><pre>/opsx-propose improve-agent-workflow-canvas
/opsx-apply improve-agent-workflow-canvas
/opsx-verify improve-agent-workflow-canvas
/opsx-archive improve-agent-workflow-canvas</pre><p>评委问项目如何持续维护时，可以展示：每次功能改动都有 proposal、design、tasks、verify 记录。</p></article>
    <article><h4>和多Agent平台的关系</h4><p>工业Agent负责机械臂任务决策；工业规范治理工作流Agent负责开发流程治理。它们不是同一类Agent，但可以统一进入“Agent组件库”：一个管工业决策，一个管工程迭代。</p><div class="governance-real-note">一句话：工业规范治理让这个项目从“演示页面”变成“有规范、有审计、有归档的工程项目”。</div></article>`;
  wrap.appendChild(real);
  return wrap;
}
const openModuleOverlayBeforeAgentDrawer = typeof openModuleOverlay === 'function' ? openModuleOverlay : null;
if(openModuleOverlayBeforeAgentDrawer){
  openModuleOverlay = function(targetId, title){
    if(targetId === 'governance-workflow'){
      const overlay = $('moduleOverlay');
      const content = $('overlayContent');
      const overlayTitle = $('overlayTitle');
      if(!overlay || !content || !overlayTitle) return;
      overlayTitle.textContent = title || '工业规范治理工作流接入中心';
      content.innerHTML = '';
      content.appendChild(buildGovernanceWorkflowDetailView());
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden','false');
      return;
    }
    return openModuleOverlayBeforeAgentDrawer(targetId, title);
  };
}

function applyPlatformVersionLabelsFromAgentDrawer(){
  document.title = '智领铜行--人工智能机械臂多Agent智能决策平台 V3.2';
  document.querySelectorAll('.brand-ver').forEach(el => el.textContent = 'V3.2');
  const version = document.querySelector('.platform-card .pc-row:last-child strong');
  if(version) version.textContent = 'V3.2';
}
document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  applyPlatformVersionLabelsFromAgentDrawer();
  ensureAgentComponentDrawer();
}, 800));


