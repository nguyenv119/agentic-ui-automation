import crypto from "crypto";
import { Page } from "playwright";
import { logger } from "../utils/logger";

/**
 * Computes a DOM fingerprint that captures:
 * - Text content (first 2000 chars)
 * - Count of interactive elements (inputs, buttons, links)
 * - Count of modals/dialogs
 * - URL (for navigation detection)
 * 
 * This fingerprint is stable and detects SPA transitions, modal openings,
 * and other DOM changes that simple innerText hashing might miss.
 */
export async function computeDomFingerprint(page: Page): Promise<string> {
  const fingerprint = await page.evaluate(() => {
    const body = document.body;
    
    return {
      text: body.innerText.slice(0, 2000),
      inputs: document.querySelectorAll("input").length,
      buttons: document.querySelectorAll("button, [role='button']").length,
      links: document.querySelectorAll("a").length,
      modals: document.querySelectorAll("[role='dialog'], [role='alertdialog']").length,
      url: window.location.href
    };
  });

  const fingerprintString = JSON.stringify(fingerprint);
  const hash = crypto.createHash("md5").update(fingerprintString).digest("hex");
  logger.debug(`DOM fingerprint hash: ${hash}`);
  return hash;
}

/**
 * Determines if a screenshot should be captured based on DOM changes.
 * @param prevHash - Previous DOM hash (null for first check)
 * @param page - Playwright page to check
 * @returns Object with changed flag and current hash
 */
export async function shouldCapture(prevHash: string | null, page: Page) {
  const hash = await computeDomFingerprint(page);
  logger.debug(`Changed: ${prevHash !== hash}`);
  return { changed: prevHash !== hash, hash };
}