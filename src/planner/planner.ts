import { Plan } from "./schema";
import { logger } from "../utils/logger";

export async function generatePlan(task: string): Promise<Plan> {
  logger.info(`[Planner] Received task: ${task}`);

  return {
    app: "notion",
    task: "Create a database table in Notion using /table",
    steps: [
      {
        step: 1,
        action: "goto",
        selector: "https://www.notion.so/new",
        description: "Go to Notion home workspace",
        value: null,
        capture: true,
      },
      {
        step: 2,
        action: "type",
        description: "Type the 'Demo' page title",
        selector: null,
        value: "Demo",
        capture: true,
      },
      {
        step: 3,
        action: "type",
        description: "Press Enter to move cursor into body",
        selector: null,
        value: "{Enter}",
        capture: true,
      },
      {
        step: 4,
        action: "wait",
        description: "Small wait for cursor to settle in body",
        selector: null,
        capture: false,
      },
      {
        step: 5,
        action: "type",
        description: "Type the `/table` slash command",
        selector: null,
        value: "/table",
        capture: true,
      },
      {
        step: 6,
        action: "wait",
        description: "Wait for slash menu to appear",
        selector: null,
        capture: true,
      },
      {
        step: 7,
        action: "type",
        description: "Press Enter to select Table from menu",
        selector: null,
        value: "{Enter}",
        capture: true,
        expectSelector: "table, [role='table'], [class*='notion-table']",
      },
    ],
  };
}
