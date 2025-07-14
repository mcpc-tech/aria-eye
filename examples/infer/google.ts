import { createEye, getBrowserWSUrl } from "index";
import puppeteer from "puppeteer";

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
    infer: true,
  });

  await page.goto("https://www.google.com/", {
    waitUntil: "networkidle2",
  });

  await eye.look("Search combobox").then(async (ele) => {
    await ele?.type("MCP");
  });

  await eye.look("Google Search button").then((ele) => {
    return ele?.click();
  });

  await page.waitForNavigation({ waitUntil: "networkidle2" });

  await eye.look("Model Context Protocol").then((ele) => {
    return ele?.click();
  });

  await eye.wait("Model Context Protocol Logo");

  console.log(await eye.snapshot(true));
}

main();
