import { Memory } from "mem0ai/oss";

export const memory = new Memory({
  version: "v1.1",
  embedder: {
    provider: "ollama",
    config: {
      model: "mxbai-embed-large:latest",
    },
  },
  vectorStore: {
    provider: "memory",
    config: {
      collectionName: "memories",
      dimension: 1024,
    },
  },
  llm: {
    provider: "openai",
    config: {
      apiKey: process.env.OPENAI_API_KEY || "",
      model: "gpt-4-turbo-preview",
    },
  },
  historyDbPath: "memory.db",
});
