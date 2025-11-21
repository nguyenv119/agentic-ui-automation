import { chromium } from "playwright";
import fs from "fs";
import path from "path";


function getAppUrl(app: string): string {
  return `https://www.${app.toLowerCase()}.com`;
}

function ensureAuthDirectory(): void {
  const authDir = path.resolve(__dirname, "../auth");
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
}

async function setupLogin() {
  const appArg = process.argv.find(arg => arg.startsWith("--app="));
  if (!appArg) {
    console.error("Usage: npm run setup-login -- --app=<app>");
    console.error("Example: npm run setup-login -- --app=notion");
    process.exit(1);
  }

  const app = appArg.split("=")[1];
  if (!app) {
    console.error("Error: App name is required");
    console.error("Usage: npm run setup-login -- --app=<app>");
    process.exit(1);
  }

  const appUrl = getAppUrl(app);
  console.log(`[AUTH] Setting up login for: ${app}`);
  console.log(`[AUTH] Opening: ${appUrl}`);

  ensureAuthDirectory();

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--enable-features=WidevineCdm',
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    permissions: ['geolocation'],
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  const page = await context.newPage();

  try {
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    
    console.log("\n[AUTH] ========================================");
    console.log(`[AUTH] Please log in manually in the browser window`);
    console.log(`[AUTH] When you're done, close the browser window or press Ctrl+C`);
    console.log(`[AUTH] ========================================\n`);

    await page.pause();
    const authDir = path.resolve(__dirname, "../auth");
    const storagePath = path.join(authDir, `${app}.json`);
    await context.storageState({ path: storagePath });

    console.log(`\n[AUTH] Login completed. State saved to auth/${app}.json`);
    console.log(`[AUTH] Agent B will automatically use this session for future runs.\n`);

  } catch (error) {
    console.error(`[AUTH] Error during login setup:`, error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

setupLogin().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

