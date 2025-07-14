import { Memory } from "mem0ai/oss";

const customPrompt = `
Your task is to process a list of web elements from the 'Input'. Each line in the 'Input' represents a distinct element. You MUST generate a descriptive fact for each line.

The 'Input' is the definitive source of information. Treat each line as independent and do not infer any hierarchy between them.

Based on the information in each line, generate a corresponding fact. The fact must explain what the element is (its type, e.g., button, link), its label, its likely purpose or action, and it MUST include the original attribute string (e.g., [ref=e83] [cursor=pointer]). The number of facts in the output array must exactly match the number of lines in the input.

Example:
Input:
button "Google Search" [ref=e83] [cursor=pointer]
button "I'm Feeling Lucky" [ref=e84] [cursor=pointer]
link "About" [ref=e99] [cursor=pointer]

Output:
{"facts":["A button labeled 'Google Search' with attributes [ref=e83] [cursor=pointer], used to submit the search query.","A button labeled 'I'm Feeling Lucky' with attributes [ref=e84] [cursor=pointer], used to go directly to the first search result.","A link with the text 'About' with attributes [ref=e99] [cursor=pointer], used to navigate to the 'About' page."]}

CRITICAL: The 'facts' array must contain ONLY strings. It must NOT contain objects. For example, do NOT generate '{"facts":[{"description":"..."}]}'. The correct format is '{"facts":["..."]}'.

Your output MUST be a compact, single-line, and strictly valid JSON object that conforms to the following JSON Schema. Do not use trailing commas or any characters outside of the single JSON object.

JSON Schema for Output:
{
  "description": "Ensures the output is an object with a 'facts' key, which contains an array of descriptive strings.",
  "type": "object",
  "properties": {
    "facts": {
      "type": "array",
      "description": "A list of descriptive facts for each web element.",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "facts"
  ]
}
`;

export const memory = new Memory({
  version: "v1.1",
  embedder: {
    provider: "ollama",
    config: {
      model: "nomic-embed-text:latest",
    },
  },
  vectorStore: {
    provider: "memory",
    config: {
      collectionName: "memories",
      dimension: 768,
    },
  },
  llm: {
    provider: "ollama",
    config: {
      model: "qwen3:latest",
    },
  },
  historyDbPath: "memory.db",
  customPrompt,
});
