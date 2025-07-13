import { existsSync, mkdirSync, rmSync } from "fs";
import { EYE_OUTPUT_DIR } from "../src/constants";
import {
  connectToBrowser,
  goToGemini,
  selectGeminiModel,
  submitGeminiPrompt,
  getGeminiSnapshot,
} from "../src/services/gemini";
import { getBrowserWSUrl } from "../src/utils/browserWsUrl";

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
