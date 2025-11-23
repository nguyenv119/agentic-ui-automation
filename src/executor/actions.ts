// src/executor/actions.ts
import { Page } from "playwright";
import { Step } from "../planner/schema";
import { logger } from "../utils/logger";

export async function executeStep(page: Page, step: Step): Promise<void> {
  switch (step.action) {
    case "goto": {
      if (!step.selector) {
        throw new Error("Goto step requires a URL selector");
      }
      await page.goto(step.selector, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      return;
    }

    case "click": {
      if (!step.selector) {
        throw new Error("Click step requires a selector");
      }
      
      const selectors = [step.selector, ...(step.fallbackSelectors || [])].filter(Boolean) as string[];
      
      let lastError: Error | null = null;
      for (const sel of selectors) {
        try {
          await page.waitForSelector(sel, { state: "visible", timeout: 3000 });
          await page.locator(sel).click({ timeout: 5000 });
          logger.debug(`Clicked: ${sel}`);
          await page.waitForTimeout(1000);
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger.debug(`Failed to click ${sel}: ${lastError.message}`);
        }
      }
      
      throw new Error(`Failed to click: ${selectors.join(", ")}`);
    }

    case "type": {
      const value = step.value ?? "";

      if (value === "{Enter}") {
        await page.waitForTimeout(500);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(500);
        return;
      }

      if (step.selector) {
        await page.waitForSelector(step.selector, { timeout: 3000 });
        await page.click(step.selector);
        await page.waitForTimeout(200);
      }
      
      await page.keyboard.type(value, { delay: 80 });
      await page.waitForTimeout(500);
      return;
    }

    case "wait": {
      if (step.selector) {
        try {
          await page.waitForSelector(step.selector, { timeout: 5000 });
          await page.waitForTimeout(500);
        } catch (error) {
          logger.warn(
            `Wait selector not found: ${step.selector}. Continuing anyway.`,
            error instanceof Error ? error.message : String(error)
          );
          await page.waitForTimeout(500);
        }
      } else {
        await page.waitForTimeout(500);
      }
      return;
    }

    default:
      throw new Error(`Unsupported action: ${step.action}`);
  }
}
