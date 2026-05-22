/*
 * 模型适配入口。
 * 保留平台模型运行相关入口上下文。
 */
(function(){
  const modelAdapterEntry = {
    source: "static/model_adapter.js",
    moduleName: "agent-model-adapter",
    registryKey: "agent_model_registry",
    inputKey: "agent_model_input"
  };

  const relatedRuntimeFiles = [
    "/static/js/platform/11-agent-model-runtime/agent_model_import_registry.js",
    "/static/js/platform/06-agent-review/agent_decision_review.js",
    "/static/js/platform/04-decision-execution/decision_stream_controller.js"
  ];
  //配置模型适配代码
  const models = [
  {
    id: "image_repair",
    name: "图像修复模型",
    type: "IMAGE_REPAIR",
    targetAgent: "视觉质量Agent",
    status: "READY"
  },
  {
    id: "yolo",
    name: "YOLO识别模型",
    type: "OBJECT_DETECT",
    targetAgent: "视觉质量Agent",
    status: "READY"
  },
  {
    id: "depth",
    name: "双目测距模型",
    type: "STEREO_DEPTH",
    targetAgent: "三维定位Agent",
    status: "READY"
  }
];

  function keepModelAdapterEntry(){
    window.__modelAdapterEntry = {
      ...modelAdapterEntry,
      relatedRuntimeFiles,
      status: "READY"
    };
  }
  //供后续视觉质量 Agent 和三维定位 Agent 调用
  function syncModels(){
   localStorage.setItem("agent_model_registry", JSON.stringify(models));

   localStorage.setItem(
     "agent_model_input",
     JSON.stringify({
        taskType: "PICK_AND_PLACE",
        models: models,
        inputStatus: "READY"
      })
    );
   }


  document.addEventListener("DOMContentLoaded", keepModelAdapterEntry);
  //绑定按钮
  document.addEventListener("DOMContentLoaded", syncModels);
})();
