/**
 * Fetches the WebSocket URL for the browser's remote debugging protocol.
 */
export async function getBrowserWSUrl(): Promise<string | null> {
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
}
