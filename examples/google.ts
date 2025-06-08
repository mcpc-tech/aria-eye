import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { createEye } from "../src/eye";
import { EYE_OUTPUT_DIR } from "../src/constants";
import puppeteer from "puppeteer";

if (!existsSync(EYE_OUTPUT_DIR)) {
  mkdirSync(EYE_OUTPUT_DIR);
} else {
  rmSync(EYE_OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(EYE_OUTPUT_DIR);
}

async function main() {
  const getBrowserWSUrl = async () => {
    try {
      const response = await fetch("http://localhost:9222/json/version");
      const data = await response.json();
      return data.webSocketDebuggerUrl;
    } catch (e) {
      console.error(`Error getting WebSocket URL: ${e}`);
      console.error(
        "Make sure Chrome/Chromium is running with --remote-debugging-port=9222"
      );
      return null;
    }
  };

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

  await eye.look("Search combobox").then((ele) => {
    return ele?.type("MCP");
  });

  await eye.look("Google Search button").then((ele) => {
    return ele?.click();
  });

  await eye.look("Model Context Protocol heading, level 3").then((ele) => {
    return ele?.click();
  });

  await eye.wait("Model Context Protocol Logo");

  console.log(await eye.snapshot(true));
}

main();
