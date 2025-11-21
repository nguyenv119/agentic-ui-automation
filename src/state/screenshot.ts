import { Page } from "playwright";
import { logger } from "../utils/logger";

export async function takeScreenshot(page: Page, screenshotPath: string) {
  logger.debug("Taking screenshot");
  
  await page.screenshot({ 
    path: screenshotPath, 
    fullPage: false,
    animations: 'disabled'
  });
  logger.info(`Screenshot saved to ${screenshotPath}`);
}
