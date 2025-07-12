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

### OpenAI-Compatible API

The server exposes endpoints compatible with OpenAI's API for chat completions and model listing.

#### Start the server

```bash
npm run server
```

#### List supported models

```http
GET /v1/models
```

#### Chat completion

```http
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "gemini-2.5-flash",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```
