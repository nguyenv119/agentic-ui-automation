// src/executor/executor.ts
import path from "path";
import fs from "fs/promises";
import { chromium } from "playwright";
import { Plan, Step, SemanticStep } from "../planner/schema";
import { shouldCapture } from "../state/stateTracker";
import { takeScreenshot } from "../state/screenshot";
import { executeStep } from "./actions";
import { logger } from "../utils/logger";
import { detectAppFromUrl } from "../auth/appDetector";
import { loadStorageState } from "../auth/storage";
import { getDomSummary } from "./domSummary";
import { refineStep } from "../planner/stepRefiner";

export type ExecutedStep = {
  step: number;
  action: "goto" | "click" | "type" | "wait";
  description: string;
  screenshot?: string;
};

export async function runPlan(
  plan: Plan,
  outputDir: string
): Promise<{ steps: ExecutedStep[] }> {
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
  const screenshotHashes: string[] = [];
  let captureIndex = 0;

  const recentHistory: Array<{
    step: number;
    action: string;
    description: string;
  }> = [];

  const planMetadataForRefiner = {
    app: plan.app || "unknown",
    task: plan.task || "unknown",
    startUrl: plan.steps[0]?.selector || "",
  };

  for (const originalStep of plan.steps) {
    let step = originalStep;
    let expectMatched = false;

    const domSummary = await getDomSummary(page);

    try {
      const domSummaryPath = path.join(
        outputDir,
        `domSummary_${step.step}.json`
      );
      await fs.writeFile(
        domSummaryPath,
        JSON.stringify(domSummary, null, 2),
        "utf-8"
      );
    } catch (err) {
      logger.warn(
        `[runPlan] Failed to save DOM summary for step ${step.step}`,
        err
      );
    }

    const semanticStep: SemanticStep = {
      step: originalStep.step,
      goal: originalStep.description,
      actionHint: originalStep.action,
      textHint: originalStep.metadata?.textHint,
      targetKind: originalStep.metadata?.targetKind,
      waitForHint: originalStep.metadata?.waitForHint,
    };

    logger.debug(`[runPlan] Original step`);
    logger.debug(JSON.stringify(originalStep, null, 2));
    if (step.action === "click" || step.action === "wait") {
      const refined = await refineStep(
        {
          ...planMetadataForRefiner,
          previousSteps: recentHistory.length > 0 ? recentHistory : undefined,
        },
        semanticStep,
        domSummary
      );
      logger.debug(`[runPlan] Refined step`);
      logger.debug(JSON.stringify(refined, null, 2));

      if (refined) {
        const primarySelector =
          refined.selector ||
          (refined.fallbackSelectors && refined.fallbackSelectors.length > 0
            ? refined.fallbackSelectors[0]
            : null);
        const remainingFallbacks = refined.selector
          ? refined.fallbackSelectors
          : (refined.fallbackSelectors || []).slice(1);

        step = {
          step: originalStep.step,
          description: refined.description,
          action: refined.action,
          selector: primarySelector,
          fallbackSelectors: remainingFallbacks,
          value: refined.value || null,
          expectSelector: refined.expectSelector,
          expectsNavigation: originalStep.expectsNavigation,
        };
      } else {
        logger.debug(
          `[runPlan] No refinement found for step ${originalStep.step}`
        );
      }
    }

    logger.info(`Executing step ${step.step}: ${step.description}`);

    if (step.step === 1 && step.action === "goto" && step.selector) {
      await page.goto(step.selector, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
    }

    await executeStep(page, step);
    await page.waitForTimeout(2000);

    if (step.expectSelector) {
      const rawSelector = step.expectSelector.trim();
      const selectorCandidates = [
        rawSelector,
        ...rawSelector.split(",").map((candidate) => candidate.trim()),
      ].filter((candidate) => candidate.length > 0);

      let lastError: unknown;

      for (const candidate of selectorCandidates) {
        try {
          await page.locator(candidate).first().waitFor({
            timeout: 5000,
            state: "visible",
          });
          expectMatched = true;
          logger.debug(
            `[Executor] Step ${step.step} expectSelector satisfied by "${candidate}"`
          );
          break;
        } catch (error) {
          lastError = error;
          logger.debug(
            `[Executor] Step ${
              step.step
            } expectSelector candidate failed "${candidate}": ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      if (!expectMatched) {
        logger.warn(
          `[Executor] Step ${step.step} expectSelector unmet after ${selectorCandidates.length} candidates: ${rawSelector}`,
          lastError
        );
      }
    }

    const { changed, hash } = await shouldCapture(prevHash, page);
    prevHash = hash;

    let screenshot: string | undefined;
    if (changed && !screenshotHashes.includes(hash)) {
      await page.waitForTimeout(500);
      captureIndex += 1;
      const filename = `step_${captureIndex}.png`;
      const screenshotPath = path.join(outputDir, filename);
      await takeScreenshot(page, screenshotPath);
      screenshot = filename;
      screenshotHashes.push(hash);
    } else if (
      !changed &&
      step.action !== "wait" &&
      !expectMatched &&
      step.expectSelector
    ) {
      logger.debug(
        `[Executor] Step ${step.step} did not change. Retrying the original step`
      );
      step = originalStep;
      await executeStep(page, step);
    }

    executedSteps.push({
      step: step.step,
      description: step.description,
      action: step.action,
      screenshot,
    });

    recentHistory.push({
      step: step.step,
      action: step.action,
      description: step.description,
    });
    if (recentHistory.length > 3) {
      recentHistory.shift();
    }

    logger.debug(`Completed step ${step.step}`);
  }

  const capturedSteps = executedSteps
    .filter((step) => Boolean(step.screenshot))
    .map((step, index) => ({
      ...step,
      step: index + 1,
    }));

  const workflowPath = path.join(outputDir, "agent_b_workflow.json");
  await fs.writeFile(
    workflowPath,
    JSON.stringify({ steps: capturedSteps }, null, 2),
    "utf-8"
  );
  logger.info(`Workflow saved to ${workflowPath}`);
  return { steps: capturedSteps };
}
