// src/planner/planner.ts
import { Plan, SemanticPlan, Step } from "./schema";
import { logger } from "../utils/logger";
import { getOpenAIClient } from "../config/openai";
import {
  OPENAI_MODEL_DEFAULT,
  SEMANTIC_PLANNER_PROMPT,
  SYSTEM_PROMPT,
  INFER_PROMPT,
} from "../config/constants";
import { cleanJsonResponse } from "../utils/helpers";


async function inferStartUrlFromTask(task: string): Promise<{ url: string; app: string }> {
  const openai = getOpenAIClient();
  
  const prompt = INFER_PROMPT.replace("<<TASK>>", task);

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL_DEFAULT,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.choices[0]?.message?.content || "{}";
  const cleaned = cleanJsonResponse(content);
  const result = JSON.parse(cleaned);
  
  logger.debug(`[inferStartUrlFromTask] LLM inferred: url=${result.url}, app=${result.app}`);
  
  return { url: result.url, app: result.app };
}

function detectAppFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    const parts = hostname.split('.');
    
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    
    return "unknown";
  } catch {
    return "unknown";
  }
}

function extractUrlFromTask(task: string): { url: string; app: string } | null {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = task.match(urlRegex);

  if (!urls || urls.length === 0) {
    return null;
  }

  const url = urls[0];
  return { url, app: detectAppFromUrl(url) };
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

  const extractedUrl = extractUrlFromTask(task);
  
  let startUrl: string;
  let app: string;
  
  if (extractedUrl) {
    startUrl = extractedUrl.url;
    app = extractedUrl.app;
    logger.info(`[Planner] Extracted URL from task - app: ${app}, URL: ${startUrl}`);
  } else {
    logger.info(`[Planner] No explicit URL found, using LLM to infer start URL and app`);
    const inferred = await inferStartUrlFromTask(task);
    startUrl = inferred.url;
    app = inferred.app;
    logger.info(`[Planner] LLM inferred - app: ${app}, URL: ${startUrl}`);
  }

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
    const removedSteps = stepsToRemove.map(
      (idx) => `Step ${mappedSteps[idx].step}: ${mappedSteps[idx].description}`
    );
    logger.debug(`[Planner] Steps marked for removal: ${removedSteps.join(", ")}`);

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
}
