import path from "path";
import fs from "fs/promises";
import { chromium } from "playwright";
import { Plan } from "../planner/schema";
import { shouldCapture } from "../state/stateTracker";
import { takeScreenshot } from "../state/screenshot";
import { executeStep } from "./actions";
import { logger } from "../utils/logger";
import { detectAppFromUrl } from "../auth/appDetector";
import { loadStorageState } from "../auth/storage";

export type ExecutedStep = {
  step: number;
  action: "goto" | "click" | "type" | "wait";
  description: string;
  url: string;
  screenshot?: string;
};

export async function runPlan(plan: Plan, outputDir: string): Promise<{ steps: ExecutedStep[] }> {
  const firstStep = plan.steps[0];
  if (!firstStep || firstStep.action !== "goto" || !firstStep.selector) {
    throw new Error("Plan must start with a goto step containing a URL");
  }

  const app = detectAppFromUrl(firstStep.selector);
  logger.info(`[Executor] Detected app ${app} from URL ${firstStep.selector}`);

  const storageState = loadStorageState(app);
  if (!storageState) {
    throw new Error(
      `[AUTH] Missing storage state for ${app}. Run: npm run setup-login -- --app=${app}`
    );
  }

  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
  });

  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  let prevHash: string | null = null;
  const executedSteps: ExecutedStep[] = [];

  for (const step of plan.steps) {
    logger.info(`Executing step ${step.step}: ${step.description}`);
    
    await executeStep(page, step);
    await page.waitForTimeout(300);
    
    if (step.expectSelector) {
      try {
        await page.waitForSelector(step.expectSelector, {
          timeout: 5000,
          state: "visible",
        });
      } catch (error) {
        logger.warn(
          `Expected selector not found: ${step.expectSelector}`,
          error
        );
      }
    }

    const { changed, hash } = await shouldCapture(prevHash, page);
    prevHash = hash;

    let screenshot: string | undefined;
    if (step.capture || changed) {
      const filename = `step_${step.step}.png`;
      const screenshotPath = path.join(outputDir, filename);
      await takeScreenshot(page, screenshotPath);
      screenshot = filename;
    }

    executedSteps.push({
      step: step.step,
      description: step.description,
      action: step.action,
      url: page.url(),
      screenshot,
    });
    
    logger.debug(`Completed step ${step.step}`);
  }

  const workflowPath = path.join(outputDir, "agent_b_workflow.json");
  await fs.writeFile(
    workflowPath,
    JSON.stringify({ steps: executedSteps }, null, 2),
    "utf-8"
  );
  logger.info(`Workflow saved to ${workflowPath}`);

  await browser.close();
  return { steps: executedSteps };
}