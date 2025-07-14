import { createEye } from "../src/eye";
import puppeteer from "puppeteer";
import { getBrowserWSUrl } from "../src/utils/browserWsUrl";

async function main() {
  const wsUrl = await getBrowserWSUrl();
  if (!wsUrl) {
    throw new Error("Could not get WebSocket URL");
  }

  const browser = await puppeteer.connect({
    browserWSEndpoint: wsUrl,
    defaultViewport: {
      width: 0,
      height: 0,
    },
  });
  const page = await browser.newPage();
  const eye = await createEye({
    platform: { name: "puppeteer", page },
  });

  await page.goto("https://www.google.com/", {
    waitUntil: "networkidle2",
  });

  await eye.look("A text input that searches").then(async (ele) => {
    await ele?.type("MCP");
  });

  await eye.look("Google Search button").then((ele) => {
    return ele?.click();
  });

  await page.waitForNavigation({ waitUntil: "networkidle2" });

  await eye.look("a mcp heading with level of 3").then((ele) => {
    return ele?.click();
  });

  await eye.wait("a mcp logo image").then((ele) => {
    return ele?.click();
  });

  console.log(await eye.snapshot(true));
}

main();
