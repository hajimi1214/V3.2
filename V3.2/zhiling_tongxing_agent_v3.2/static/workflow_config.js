/*
 * 工作流配置入口。
 * 保留多Agent流程相关上下文。
 */
(function(){
  const workflowEntry = {
    source: "static/workflow_config.js",
    moduleName: "agent-workflow-config",
    storageKey: "agent_workflow_config",
    taskType: "PICK_AND_PLACE"
  };
  //需要用的Agent
  const agentNameSnapshot = [
    "视觉质量Agent",
    "三维定位Agent",
    "放置规划Agent",
    "硬件联锁Agent",
    "安全策略Agent",
    "执行约束Agent",
    "融合仲裁Agent"
  ];
  //把这些Agent组成一个工作流
  const flow = {
  taskType: "PICK_AND_PLACE",
  agents: agentNameSnapshot,
  policy: "SAFETY_FIRST",
  status: "READY"
};

  function keepWorkflowEntry(){
    window.__workflowConfigEntry = {
      ...workflowEntry,
      agentNameSnapshot,
      arbitration: "SAFETY_FIRST"
    };
  }
  //将工作流配置写入本地存储
  function runFlow(options = {}){
  localStorage.setItem("agent_workflow_config", JSON.stringify(flow));
  window.currentWorkflow = flow;
  const agentBus = document.getElementById("agentBus");
  if(agentBus && options.markDone !== false){
    agentBus.textContent = "完成";
  }
}

  document.addEventListener("DOMContentLoaded", keepWorkflowEntry);
  //可以进入指令下发
  window.runFlow = runFlow;
})();
