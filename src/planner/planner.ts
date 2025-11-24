// src/planner/planner.ts
import { Plan, SemanticPlan, Step } from "./schema";
import { logger } from "../utils/logger";
import { getOpenAIClient } from "../config/openai";
import {
  OPENAI_MODEL_DEFAULT,
  SEMANTIC_PLANNER_PROMPT,
  SYSTEM_PROMPT,
} from "../config/constants";
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
  logger.info(`[Planner] Received task: ${task}`);
  const openai = getOpenAIClient();

  const { url: startUrl, app } = extractUrlFromTask(task);
  logger.info(`[Planner] Detected app: ${app}, URL: ${startUrl}`);

  const docsContext = await getDocsContext(task, app);
  logger.debug(`[Planner] Docs context received`);

  const plannerPrompt = SEMANTIC_PLANNER_PROMPT.replace("<<APP_NAME>>", app)
    .replace("<<START_URL>>", startUrl)
    .replace("<<DOCS_CONTEXT>>", docsContext)
    .concat(`\n\nTask: ${task}`);

  logger.debug("[Planner] Requesting semantic plan from OpenAI");
  logger.debug(`[Planner] Planner prompt: ${plannerPrompt}`);

  const res = await openai.chat.completions.create({
    model: OPENAI_MODEL_DEFAULT,
    temperature: 0,
    messages: [{ role: "user", content: plannerPrompt }],
  });

  const rawContent = res.choices[0].message?.content || "{}";
  const cleanedContent = cleanJsonResponse(rawContent);

  let semanticPlan: SemanticPlan;
  try {
    semanticPlan = JSON.parse(cleanedContent) as SemanticPlan;
    logger.debug("[Planner] Semantic JSON parsed successfully", {
      semanticPlan,
    });
  } catch (parseError) {
    logger.error("[Planner] Failed to parse JSON from OpenAI response", {
      rawContent,
      cleanedContent,
      error: parseError,
    });
    throw new Error(
      `Invalid JSON response from OpenAI: ${
        parseError instanceof Error ? parseError.message : String(parseError)
      }`
    );
  }

  let mappedSteps: Step[] = semanticPlan.steps.map((s) => ({
    step: s.step,
    description: s.goal,
    action: (s.actionHint &&
    ["goto", "click", "type", "wait"].includes(s.actionHint)
      ? s.actionHint
      : "wait") as any,
    selector: s.actionHint === "goto" ? startUrl : null,
    value: s.textHint || null,
    metadata: {
      textHint: s.textHint,
      targetKind: s.targetKind,
      waitForHint: s.waitForHint,
    },
  }));

  const stepsToRemove: number[] = [];

  for (let i = 0; i < mappedSteps.length - 1; i++) {
    const currentStep = mappedSteps[i];
    const nextStep = mappedSteps[i + 1];

    const isSlashCommand =
      currentStep.action === "type" &&
      currentStep.value &&
      /^\/\w+\{Enter\}/.test(currentStep.value);

    const isRedundantClick =
      nextStep.action === "click" &&
      (nextStep.description.toLowerCase().includes("select") ||
        nextStep.description.toLowerCase().includes("choose") ||
        nextStep.description.toLowerCase().includes("table") ||
        nextStep.description.toLowerCase().includes("board") ||
        nextStep.description.toLowerCase().includes("list"));

    if (isSlashCommand && isRedundantClick) {
      logger.debug(
        `[Planner] Marking step ${nextStep.step} as redundant after slash command in step ${currentStep.step}`
      );
      stepsToRemove.push(i + 1);
    }
  }

  if (stepsToRemove.length > 0) {
    mappedSteps = mappedSteps.filter(
      (_, index) => !stepsToRemove.includes(index)
    );
    mappedSteps = mappedSteps.map((s, index) => ({ ...s, step: index + 1 }));
    logger.info(
      `[Planner] Removed ${stepsToRemove.length} redundant step(s) from plan`
    );
  }

  if (mappedSteps.length === 0 || mappedSteps[0].action !== "goto") {
    logger.info("[Planner] First step is not goto, injecting navigation step");
    const gotoStep: Step = {
      step: 1,
      description: `Navigate to ${app}`,
      action: "goto",
      selector: startUrl,
      value: null,
      metadata: {
        textHint: null,
        targetKind: "other",
        waitForHint: null,
      },
    };

    mappedSteps = mappedSteps.map((s) => ({ ...s, step: s.step + 1 }));
    mappedSteps.unshift(gotoStep);
  }

  const plan: Plan = {
    app: semanticPlan.app,
    task: semanticPlan.task,
    metadata: {
      useLiveRefiner: true,
    },
    steps: mappedSteps,
  };

  logger.info("[Planner] Plan generated and mapped successfully");
  logger.debug("[Planner] Plan", JSON.stringify(plan, null, 2));
  return plan;

  // return {
  //   "app": "notion",
  //   "task": "How do I make a database in Notion?",
  //   "metadata": {
  //     "useLiveRefiner": true
  //   },
  //   "steps": [
  //     {
  //       "step": 1,
  //       "description": "Navigate to the Notion new page creation screen",
  //       "action": "goto",
  //       "selector": "https://www.notion.so/new",
  //       "value": null,
  //       "metadata": {}
  //     },
  //     {
  //       "step": 2,
  //       "description": "Set a title for the new page to prepare for database creation",
  //       "action": "type",
  //       "selector": null,
  //       "value": "Database{Enter}",
  //       "metadata": {
  //         "textHint": "Database{Enter}",
  //         "targetKind": "input"
  //       }
  //     },
  //     {
  //       "step": 3,
  //       "description": "Open the command menu to create a database",
  //       "action": "type",
  //       "selector": null,
  //       "value": "/database{Enter}",
  //       "metadata": {
  //         "textHint": "/database{Enter}",
  //         "targetKind": "input"
  //       }
  //     },
  //     {
  //       "step": 5,
  //       "description": "Rename the database to something relevant",
  //       "action": "type",
  //       "selector": null,
  //       "value": "My Database{Enter}",
  //       "metadata": {
  //         "textHint": "My Database{Enter}",
  //         "targetKind": "input"
  //       }
  //     },
  //     {
  //       "step": 6,
  //       "description": "Add properties to the database",
  //       "action": "click",
  //       "selector": null,
  //       "value": "+",
  //       "metadata": {
  //         "textHint": "+",
  //         "targetKind": "button"
  //       }
  //     },
  //     {
  //       "step": 7,
  //       "description": "Select the type of property to add",
  //       "action": "click",
  //       "selector": null,
  //       "value": "Text",
  //       "metadata": {
  //         "textHint": "Text",
  //         "targetKind": "menuItem"
  //       }
  //     },
  //     {
  //       "step": 8,
  //       "description": "Enter a name for the new property",
  //       "action": "type",
  //       "selector": null,
  //       "value": "Description{Enter}",
  //       "metadata": {
  //         "textHint": "Description{Enter}",
  //         "targetKind": "input"
  //       }
  //     },
  //     {
  //       "step": 9,
  //       "description": "Start entering data into the database",
  //       "action": "click",
  //       "selector": null,
  //       "value": "Empty cell",
  //       "metadata": {
  //         "textHint": "Empty cell",
  //         "targetKind": "container"
  //       }
  //     },
  //     {
  //       "step": 10,
  //       "description": "Add a new row to the database",
  //       "action": "click",
  //       "selector": null,
  //       "value": "+ New",
  //       "metadata": {
  //         "textHint": "+ New",
  //         "targetKind": "button"
  //       }
  //     }
  //   ]
  // }
}
