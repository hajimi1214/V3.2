/*
 * 人工智能机械臂多Agent智能决策平台前端启动清单。
 */
(function loadZhilingTongxingPlatformScripts(){
  const modules = [
    '/static/js/platform/00-platform-foundation/screen_adaptive_runtime.js',
    '/static/js/platform/00-platform-foundation/platform_foundation_registry.js',
    '/static/js/platform/01-device-runtime/device_runtime_gate.js',
    '/static/js/platform/02-decision-topology/decision_topology_renderer.js',
    '/static/js/platform/03-module-center/module_overlay_center.js',
    '/static/js/platform/04-decision-execution/decision_stream_controller.js',
    '/static/js/platform/05-platform-runtime/platform_runtime_metadata.js',
    '/static/js/platform/06-agent-review/agent_decision_review.js',
    '/static/js/platform/07-workflow-canvas/workflow_canvas_builder.js',
    '/static/js/platform/08-arbitration-policy/arbitration_policy_modes.js',
    '/static/js/platform/09-manual-workflow/manual_workflow_canvas.js',
    '/static/js/platform/10-workflow-layout/workflow_layout_controller.js',
    '/static/js/platform/11-agent-model-runtime/agent_model_import_registry.js',
    '/static/js/platform/12-governance-workflow/governance_workflow_drawer.js',
    '/static/js/platform/13-navigation-shell/platform_navigation_shell.js',
    '/static/js/platform/14-industrial-state-media/industrial_state_media_gate.js',
    '/static/js/platform/15-execution-topology/device_gated_execution_topology.js',
    '/static/js/platform/16-command-dispatch/command_dispatch_gateway.js',
    '/static/js/platform/17-device-persistence/persistent_device_state.js',
    '/static/js/platform/18-decision-session/decision_session_persistence.js',
    '/static/js/platform/19-stable-workbench/stable_workbench_runtime_v32.js',
    '/static/js/platform/20-persistence-trace/authoritative_tree_trace_runtime_v32.js',
    '/static/js/platform/21-persistence-lock/final_tree_persistence_lock_v32.js',
    '/static/js/platform/98-presentation-runtime/presentation_runtime.js',
    '/static/js/platform/100-operator-console/operator_console_runtime.js',
    '/static/js/platform/101-decision-console-restyle/decision_console_restyle.js',
    '/static/js/platform/102-reviewed-console/reviewed_console_final.js',
    '/static/js/platform/103-responsive-refinement/operator_console_refined_v2.js',
    '/static/js/platform/104-field-qc/field_qa_final.js',

  ];
  for (const src of modules) {
    document.write('<script src="' + src + '"><\/script>');
  }
})();
