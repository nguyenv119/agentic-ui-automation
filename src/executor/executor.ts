export const runPlan = async () => {
  [
    { "step": 1, "description": "Navigate to Linear project list", "action": "goto" },
    { "step": 2, "description": "Create new project", "action": "click" },
    { "step": 3, "description": "Switch to Notion database view", "action": "goto" },
    { "step": 4, "description": "Apply filter", "action": "click" }
  ]
};