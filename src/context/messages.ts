export function buildPrompt(
  messages: Array<{ role?: string; content?: string }>
): string {
  const instruction =
    "Conversation format: system/user/assistant. Reply as assistant.";
  if (!messages || messages.length === 0) return instruction;
  // Concatenate all messages, defaulting missing values
  return (
    instruction +
    "\n" +
    messages.map((msg) => `${msg.role}: ${msg.content ?? ""}`).join("\n")
  );
}
