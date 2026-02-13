# Aria Eye

## Usage Examples

### Eye API (Automation)

#### Example: Google Search Automation

```typescript
import { createEye } from "./src/eye";
import puppeteer from "puppeteer";

async function main() {
  const browser = await puppeteer.connect({
    browserWSEndpoint: "ws://localhost:9222/devtools/browser/...",
  });
  const page = await browser.newPage();
  const eye = await createEye({ platform: { name: "puppeteer", page } });

  await page.goto("https://www.google.com/");
  await eye.look("Search combobox").then((ele) => ele?.type("MCP"));
  await eye.look("Google Search button").then((ele) => ele?.click());
  await page.waitForNavigation();
  console.log(await eye.snapshot(true));
}
main();
```
