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

  // Navigate to a form demo page
  await page.goto("https://httpbin.org/forms/post", {
    waitUntil: "networkidle2",
  });

  console.log("Demo: Using eye.act() for various form interactions");

  // Example 1: Type text into input fields
  await eye.act('type "John Doe" into the customer name field');
  
  // Example 2: Type email with submit
  await eye.act('type "john.doe@example.com" into email field');
  
  // Example 3: Click on buttons or links
  await eye.act("click the submit button");

  // Wait a moment to see the result
  await eye.blink(2000);

  // Navigate to Google for more examples
  await page.goto("https://www.google.com/", {
    waitUntil: "networkidle2",
  });

  // Example 4: Search using natural language
  await eye.act('type "artificial intelligence" into the search box');
  await eye.act("click the Google Search button");
  
  await page.waitForNavigation({ waitUntil: "networkidle2" });

  // Example 5: Click on search results
  await eye.act("click the first search result link");
  
  await page.waitForNavigation({ waitUntil: "networkidle2" });

  // Example 6: Hover over elements
  await eye.act("hover over the main navigation menu");

  // Example 7: Use keyboard shortcuts
  await eye.act("press key Escape");

  console.log("Final page snapshot:");
  console.log(await eye.snapshot(true));

  await browser.close();
}

main().catch(console.error);
