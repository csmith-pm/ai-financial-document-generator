import puppeteer, { type Browser, type Page } from "puppeteer";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { ChartConfig } from "./chartTypes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATE_PATH = join(__dirname, "chartTemplate.html");

const MAX_CONCURRENCY = 4;

let browserInstance: Browser | null = null;

/** Get or create the shared browser instance. */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browserInstance;
}

/** Close the shared browser instance (call on shutdown). */
export async function closeBrowser(): Promise<void> {
  if (browserInstance && browserInstance.connected) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/** Render a single chart config to a PNG buffer. */
export async function renderChartToImage(config: ChartConfig): Promise<Buffer> {
  const browser = await getBrowser();
  const page: Page = await browser.newPage();

  try {
    const html = await readFile(TEMPLATE_PATH, "utf-8");
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Wait for the template to be ready
    await page.waitForFunction("window.__ready === true", {
      timeout: 15000,
    });

    // Pass config to the page and render the chart
    await page.evaluate((cfg) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__renderChart(cfg);
    }, config as unknown as Record<string, unknown>);

    // Wait for React to render
    await page.waitForSelector("#chart-root > div", { timeout: 10000 });

    // Small delay for Recharts animations to settle
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Set viewport to chart dimensions and screenshot the chart element
    await page.setViewport({
      width: config.width + 20,
      height: config.height + 20,
    });

    const chartElement = await page.$("#chart-root");
    if (!chartElement) {
      throw new Error("Chart root element not found after render");
    }

    const screenshot = await chartElement.screenshot({
      type: "png",
      omitBackground: false,
    });

    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}

/** Render multiple chart configs to PNG buffers with concurrency limiting. */
export async function renderChartsForSection(
  configs: ChartConfig[]
): Promise<Buffer[]> {
  const results: Buffer[] = new Array(configs.length);
  const queue = configs.map((config, index) => ({ config, index }));

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      results[item.index] = await renderChartToImage(item.config);
    }
  }

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENCY, configs.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}
