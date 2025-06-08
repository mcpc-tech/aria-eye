import { createOpenAI } from "@ai-sdk/openai";
import { cosineSimilarity, Embedding, EmbeddingModel, embedMany } from "ai";
import { EMBEDDING_MODEL, OLLAMA_BASE_URL } from "../constants";
import { ElementEmbeddingWithSimilarity } from "../types";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const ollama = createOpenAI({
  apiKey: "ollama",
  baseURL: OLLAMA_BASE_URL,
});

export const venus = createOpenAI({
  baseURL: "http://v2.open.venus.oa.com/llmproxy",
  apiKey: process.env.VENUS_API_KEY,
});

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function embed(values: Array<string>) {
  const { embeddings } = await embedMany({
    model: ollama.embedding(EMBEDDING_MODEL),
    values: values,
  });
  return embeddings;
}

export async function retriveEmbeddingsWithCosineSimilarity(
  targetEmbeding: Embedding,
  embeddings: Embedding[]
) {
  const similarities = embeddings.map((e, index) => ({
    similarity: cosineSimilarity(targetEmbeding, e),
    index,
  }));
  return similarities.sort(
    (a, b) => b.similarity - a.similarity
  ) as ElementEmbeddingWithSimilarity[];
}
