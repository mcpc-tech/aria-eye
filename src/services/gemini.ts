import puppeteer, { Page } from "puppeteer";
import { createEye } from "../eye";
import clipboard from "clipboardy";

// Cache for goToGemini results per browser instance
const geminiCache = new WeakMap<
  import("puppeteer").Browser,
  import("puppeteer").Page
>();

// Cache for browser instances per wsUrl
const browserCache = new Map<string, Promise<import("puppeteer").Browser>>();

export async function connectToBrowser(wsUrl: string) {
  if (browserCache.has(wsUrl)) {
    return browserCache.get(wsUrl)!;
  }
  const browserPromise = puppeteer.connect({
    browserWSEndpoint: wsUrl,
    defaultViewport: { width: 0, height: 0 },
  });
  browserCache.set(wsUrl, browserPromise);
  return browserPromise;
}

export async function goToGemini(browser: import("puppeteer").Browser) {
  let page: import("puppeteer").Page | undefined;
  if (geminiCache.has(browser)) {
    page = geminiCache.get(browser)!;
  } else {
    page = await browser.newPage();
    await page.setBypassCSP(true);
    await page.goto("https://gemini.google.com/app", {
      waitUntil: "networkidle2",
    });
    geminiCache.set(browser, page);
  }
  const eye = await createEye({ platform: { name: "puppeteer", page } });
  return { page, eye };
}

export async function selectGeminiModel(
  eye: Awaited<ReturnType<typeof createEye>>,
  modelName: string = "gemini-2.5-flash"
) {
  await eye
    .look(`A button to select the Gemini model`)
    .then((ele) => ele?.click());
  await eye.look(`Select the model 2.5 Pro for reasoning`).then((ele) => ele?.click());
}

export async function submitGeminiPrompt(
  eye: Awaited<ReturnType<typeof createEye>>,
  prompt: string
) {
  await eye.look("A input box to enter a prompt").then(async (ele) => {
    if (ele) {
      await ele.evaluate((el, value) => {
        (el as HTMLInputElement).innerText = value;
      }, prompt);
      await ele.press("Enter");
    }
  });
}

export async function getGeminiSnapshot(
  eye: Awaited<ReturnType<typeof createEye>>
) {
  return eye.snapshot(true);
}

export async function getGeminiResponse(
  eye: Awaited<ReturnType<typeof createEye>>,
  page: Page
) {
  const ele = await eye.wait("button Copy");
  await ele.click();
  return clipboard.readSync();
}
