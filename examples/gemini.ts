import { existsSync, mkdirSync, rmSync } from "fs";
import { EYE_OUTPUT_DIR } from "../src/constants";
import {
  getBrowserWSUrl,
  connectToBrowser,
  goToGemini,
  selectGeminiModel,
  submitGeminiPrompt,
  getGeminiSnapshot,
} from "../src/services/gemini";

if (!existsSync(EYE_OUTPUT_DIR)) {
  mkdirSync(EYE_OUTPUT_DIR);
} else {
  rmSync(EYE_OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(EYE_OUTPUT_DIR);
}

async function main() {
  const wsUrl = await getBrowserWSUrl();
  if (!wsUrl) throw new Error("Could not get WebSocket URL");
  const browser = await connectToBrowser(wsUrl);
  const { eye } = await goToGemini(await browser);

  await selectGeminiModel(eye, "gemini-2.5-flash");
  await submitGeminiPrompt(eye, "hello");
  await getGeminiSnapshot(eye);
}

main();
