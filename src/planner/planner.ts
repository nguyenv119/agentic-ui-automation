import { Plan, PlanSchema } from "./schema";
import { logger } from "../utils/logger";
import { getOpenAIClient } from "../config/openai";
import { OPENAI_MODEL_DEFAULT, PLANNER_PROMPT, SYSTEM_PROMPT } from "../config/constants";
import { cleanJsonResponse } from "../utils/helpers";

function detectAppFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("notion.so")) return "notion";
  if (lower.includes("linear.app")) return "linear";
  if (lower.includes("asana.com")) return "asana";
  return "unknown";
}

function extractUrlFromTask(task: string): { url: string; app: string } {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = task.match(urlRegex);
  if (urls?.length) {
    const url = urls[0];
    return { url, app: detectAppFromUrl(url) };
  }

  const lower = task.toLowerCase();
  if (lower.includes("notion")) {
    return { url: "https://www.notion.so/new", app: "notion" };
  }
  if (lower.includes("linear")) {
    return { url: "https://linear.app", app: "linear" };
  }
  if (lower.includes("asana")) {
    return { url: "https://app.asana.com", app: "asana" };
  }

  return { url: "https://www.notion.so/new", app: "notion" };
}

async function getDocsContext(task: string, app: string): Promise<string> {
  const openai = getOpenAIClient();

  const res = await openai.chat.completions.create({
    model: OPENAI_MODEL_DEFAULT,
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT.replace("<<APP_NAME>>", app) },
      { role: "user", content: `Task: ${task}` },
    ],
  });

  return res.choices[0].message?.content ?? "";
}

export async function generatePlan(task: string): Promise<Plan> {
  // logger.info(`[Planner] Received task: ${task}`);
  // const openai = getOpenAIClient();

  // const { url: startUrl, app } = extractUrlFromTask(task);
  // logger.info(`[Planner] Detected app: ${app}, URL: ${startUrl}`);

  // const docsContext = await getDocsContext(task, app);
  // logger.debug(`[Planner] Docs context received: ${docsContext}`);

  // const plannerPrompt = PLANNER_PROMPT
  //   .replace("<<APP_NAME>>", app)
  //   .replace("<<START_URL>>", startUrl)
  //   .replace("<<DOCS_CONTEXT>>", docsContext)
  //   .concat(`\n\nTask: ${task}`);

  // logger.debug("[Planner] Requesting plan from OpenAI");

  // const res = await openai.chat.completions.create({
  //   model: OPENAI_MODEL_DEFAULT,
  //   temperature: 0.1,
  //   messages: [
  //     { role: "user", content: plannerPrompt },
  //   ],
  // });

  // logger.debug("[Planner] OpenAI responded");

  // const rawContent = res.choices[0].message?.content || "{}";
  // const cleanedContent = cleanJsonResponse(rawContent);

  // let json: unknown;
  // try {
  //   json = JSON.parse(cleanedContent);
  //   logger.debug("[Planner] JSON parsed successfully", { json });
  // } catch (parseError) {
  //   logger.error("[Planner] Failed to parse JSON from OpenAI response", {
  //     rawContent,
  //     cleanedContent,
  //     error: parseError,
  //   });
  //   throw new Error(
  //     `Invalid JSON response from OpenAI: ${
  //       parseError instanceof Error ? parseError.message : String(parseError)
  //     }`
  //   );
  // }

  // const { success, data, error } = PlanSchema.safeParse(json);
  // if (!success) {
  //   logger.error("[Planner] Invalid plan schema", error);
  //   throw new Error("Invalid plan schema from OpenAI");
  // }

  // logger.info("[Planner] Plan generated successfully");
  // return data;
  return {
      "app": "notion",
      "task": "Filter a database in Notion",
      "steps": [
        {
          "step": 1,
          "action": "goto",
          "selector": "https://www.notion.so/new",
          "description": "Open a new Notion page",
          "value": null,
        },
        {
          "step": 2,
          "action": "type",
          "selector": null,
          "description": "Type page title 'Demo'",
          "value": "Demo",
        },
        {
          "step": 3,
          "action": "type",
          "selector": null,
          "description": "Press Enter to move into body",
          "value": "{Enter}",
        },
        {
          "step": 4,
          "action": "type",
          "selector": null,
          "description": "Insert a database via slash command",
          "value": "/database",
        },
        {
          "step": 5,
          "action": "wait",
          "selector": null,
          "description": "Wait for slash menu to appear",
        },
        {
          "step": 6,
          "action": "type",
          "selector": null,
          "description": "Press Enter to create the database",
          "value": "{Enter}",
        },
        {
          "step": 7,
          "action": "wait",
          "selector": "[role='table'], [class*='notion-database'], database",
          "description": "Wait for the database to render",
        },
        {
          "step": 8,
          "action": "click",
          "selector": "[aria-label='Settings']",
          "description": "Open Settings menu for the database",
          "value": null,
          "fallbackSelectors": [
            "[aria-label='Settings']",
            "button[aria-label*='Settings']",
          ]
        },
        {
          "step": 9,
          "action": "click",
          "selector": "[aria-label='Filter']",
          "description": "Open Filter menu for the database",
          "value": null,
          "fallbackSelectors": [
            "text=Filter",
            "div:has-text('Filter')",
            "role=button[name='Filter']"
          ]
        }
      ]
    }
  }
