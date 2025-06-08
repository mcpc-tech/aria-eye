import { Page, SerializedAXNode } from "puppeteer";
import { Embedding } from "ai";
import { retriveEmbeddingsWithCosineSimilarity } from "../services/embed";

export interface ElementEmbedding {
  type: "text" | "image" | "button" | "other";
  embedding: number[];
  elementText?: string;
  imageBase64?: string;
  description?: string;
}

export interface ElementEmbeddingWithSimilarity {
  similarity: number;
  index: number;
}

export interface ProcessedElement {
  tag: string;
  type: string;
  base64: string | null;
  textContent: string | null;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  mouseClickArgs: Parameters<Page["mouse"]["click"]> | null;
  accessibility: {
    role: string;
    name: string;
    value: string;
  };
  description: string;
  similarity?: ElementEmbeddingWithSimilarity['similarity'];
}

export interface ElementDescriptionParams {
  tag: string;
  type: string;
  textContent: string | null;
  accessibility: { role: string; name: string; value: string };
  attributes: Record<string, string>;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
}

export interface PageEmbeddingResult {
  embeddings: Embedding[];
  elements: ProcessedElement[];
}
