process.env.MEM0_TELEMETRY = "false";

import { Memory } from "@yaonyan/mem0ai/oss";

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

const updatePrompt = `
You are an intelligent Web Page State Manager. Your task is to synchronize the 'Old Memory' (the previous state of the page) with the 'Retrieved Facts' (the current state of the page).

You must compare the 'Retrieved Facts' with the 'Old Memory' and decide on one of four operations for each element: ADD, UPDATE, DELETE, or NONE.

The primary identifier for any element is its 'ref' attribute (e.g., [ref=e83]).

Here are the rules for each operation:

1.  **ADD**: If a fact appears in 'Retrieved Facts' with a 'ref' that does NOT exist in the 'Old Memory', you must add it as a new memory item.
2.  **UPDATE**: If a fact in 'Retrieved Facts' has the same 'ref' as an item in 'Old Memory' but its descriptive text has changed, you must update the existing memory item.
3.  **DELETE**: If a memory item in 'Old Memory' has a 'ref' that is NO LONGER PRESENT in the 'Retrieved Facts', you must mark it for deletion. This is critical for removing elements that have disappeared from the page.
4.  **NONE**: If a memory item in 'Old Memory' is identical to the corresponding fact in 'Retrieved Facts' (matching both 'ref' and text), no change is needed.

---
**Example Scenario:**

* **Old Memory:**
    [
        {"id": "mem1", "text": "A button labeled 'Google Search' with attributes [ref=e83] [cursor=pointer], used to submit the search query."},
        {"id": "mem2", "text": "A link with the text 'About' with attributes [ref=e99] [cursor=pointer], used to navigate to the 'About' page."},
        {"id": "mem3", "text": "A link with the text 'Privacy' with attributes [ref=e105] [cursor=pointer], used to navigate to the 'Privacy' page."}
    ]

* **Retrieved Facts:**
    [
        "A button labeled 'Google Search' with attributes [ref=e83] [cursor=pointer], used to submit the search query.",
        "A link with the text 'About Us' with attributes [ref=e99] [cursor=pointer], used to navigate to the company's 'About' page.",
        "A button labeled 'I'm Feeling Lucky' with attributes [ref=e84] [cursor=pointer], used to go directly to the first search result."
    ]

* **Correct New Memory Output:**
    {
        "memory": [
            {
                "id": "mem1",
                "text": "A button labeled 'Google Search' with attributes [ref=e83] [cursor=pointer], used to submit the search query.",
                "event": "NONE"
            },
            {
                "id": "mem2",
                "text": "A link with the text 'About Us' with attributes [ref=e99] [cursor=pointer], used to navigate to the company's 'About' page.",
                "event": "UPDATE",
                "old_memory": "A link with the text 'About' with attributes [ref=e99] [cursor=pointer], used to navigate to the 'About' page."
            },
            {
                "id": "mem3",
                "text": "A link with the text 'Privacy' with attributes [ref=e105] [cursor=pointer], used to navigate to the 'Privacy' page.",
                "event": "DELETE"
            },
            {
                "id": "mem4",
                "text": "A button labeled 'I'm Feeling Lucky' with attributes [ref=e84] [cursor=pointer], used to go directly to the first search result.",
                "event": "ADD"
            }
        ]
    }
---

Your output MUST be a valid JSON object.
`;

export const memory = new Memory({
  version: "v1.1",
  embedder: {
    provider: "ollama",
    config: {
      url: process.env.OLLAMA_URL || "http://localhost:11434",
      // model: "nomic-embed-text:latest",
      model: "dengcao/Qwen3-Embedding-0.6B:Q8_0",
    },
  },
  // embedder: {
  //   provider: "openai",
  //   config: {
  //     apiKey: process.env.OPENAI_API_KEY,
  //     model: "text-embedding-3-large",
  //   },
  // },
  vectorStore: {
    provider: "memory",
    config: {
      collectionName: "memories",
      // dimension: 768,
      /// qwen
      dimension: 1024,
    },
  },
  // llm: {
  //   provider: "ollama",
  //   config: {
  //     model: "qwen3:latest",
  //     // @ts-ignore
  //     temperature: 0.0,
  //   },
  // },
  llm: {
    provider: "openai",
    config: {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: "google/gemini-2.5-flash",
      baseURL: "https://openrouter.ai/api/v1",
      // @ts-ignore
      temperature: 0.0,
    },
  },
  // llm: {
  //   provider: "openai_structured",
  //   config: {
  //     model: "gpt-4o-2024-08-06",
  //     apiKey: process.env.OPENAI_API_KEY,
  //     temperature: 0.0,
  //   },
  // },
  historyDbPath: "memory.db",
  customPrompt,
  updatePrompt,
});
