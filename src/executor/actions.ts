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

      const selectors = [
        step.selector,
        ...(step.fallbackSelectors || []),
      ].filter(Boolean) as string[];

      let lastError: Error | null = null;
      for (const sel of selectors) {
        try {
          await page.waitForSelector(sel, { state: "visible", timeout: 3000 });
          await page.locator(sel).click({ timeout: 5000 });
          logger.debug(`Clicked: ${sel}`);
          await page.waitForTimeout(1000);
          
          if (step.metadata?.targetKind === "button" || step.description.toLowerCase().includes("add property")) {
            await page.waitForTimeout(500);
          }
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger.debug(`Failed to click ${sel}: ${lastError.message}`);
        }
      }

      logger.warn(
        `[executeStep] Failed to click after trying all selectors: ${selectors.join(", ")}. Continuing anyway as this may not be critical.`
      );
      return;
    }

    case "type": {
      const value = step.value ?? "";
      const locator = step.selector ? page.locator(step.selector) : null;
    
      if (locator) {
        try {
          await locator.waitFor({ state: "visible", timeout: 3000 });
          await locator.click();
          await page.waitForTimeout(200);
        } catch (e) {
          logger.warn(
            `Could not click selector ${step.selector} before typing. Attempting to type anyway.`
          );
        }
      } else {
        logger.debug(
          "No selector for type step; typing into currently focused element."
        );
      }
    
      const specialKeyPattern =
        /\{(Enter|Tab|Escape|Backspace|Delete|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)\}/g;
      const segments: Array<{ text?: string; key?: string }> = [];
    
      let lastIndex = 0;
      let match;
      while ((match = specialKeyPattern.exec(value)) !== null) {
        if (match.index > lastIndex) {
          segments.push({ text: value.substring(lastIndex, match.index) });
        }
        segments.push({ key: match[1] });
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < value.length) {
        segments.push({ text: value.substring(lastIndex) });
      }
      if (segments.length === 0 && value) {
        segments.push({ text: value });
      }
    
      for (const segment of segments) {
        if (segment.text) {
          if (locator) {
            await locator.pressSequentially(segment.text, { delay: 80 });
          } else {
            await page.keyboard.type(segment.text, { delay: 80 });
          }
        } else if (segment.key) {
          await page.waitForTimeout(200);
          if (locator) {
            await locator.press(segment.key);
          } else {
            await page.keyboard.press(segment.key);
          }
          await page.waitForTimeout(200);
        }
      }
    
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
