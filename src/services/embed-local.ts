import { ElementEmbeddingWithSimilarity } from "../types";
import {
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  AutoTokenizer,
  AutoProcessor,
  RawImage,
  PreTrainedTokenizer,
  PreTrainedModel,
  Processor,
} from "@huggingface/transformers";
import * as tf from "@tensorflow/tfjs-node-gpu";
import { cosineSimilarity, Embedding } from "ai";

// Cache the models and tokenizers to avoid reloading
let tokenizer: PreTrainedTokenizer | null = null;
let textModel: PreTrainedModel | null = null;
let processor: Processor | null = null;
let visionModel: PreTrainedModel | null = null;

// Initialize the text models
async function initTextModels() {
  if (!tokenizer || !textModel) {
    tokenizer = await AutoTokenizer.from_pretrained(
      "Xenova/clip-vit-base-patch16"
    );
    textModel = await CLIPTextModelWithProjection.from_pretrained(
      "Xenova/clip-vit-base-patch16",
      { dtype: "fp32" }
    );
  }
  return { tokenizer, textModel };
}

// Initialize the vision models
async function initVisionModels() {
  if (!processor || !visionModel) {
    processor = await AutoProcessor.from_pretrained(
      "Xenova/clip-vit-base-patch16",
      {}
    );
    visionModel = await CLIPVisionModelWithProjection.from_pretrained(
      "Xenova/clip-vit-base-patch16",
      { dtype: "fp32" }
    );
  }
  return { processor, visionModel };
}

/**
 * Generate embeddings for mixed content with automatic detection
 * @param content Array of strings (can be text or base64 image data)
 * @returns Object containing text and image embeddings with their original inputs
 */
export async function embed(content: string[]) {
  const texts: string[] = [];
  const textIndices: number[] = [];
  const images: string[] = [];
  const imageIndices: number[] = [];

  // Automatically categorize content as text or image
  content.forEach((item, index) => {
    if (isBase64Image(item)) {
      images.push(item);
      imageIndices.push(index);
    } else {
      texts.push(item);
      textIndices.push(index);
    }
  });

  // Generate embeddings
  const textEmbeddings = texts.length > 0 ? await embedTexts(texts) : [];
  const imageEmbeddings = images.length > 0 ? await embedImages(images) : [];

  // Map embeddings back to their original indices
  const embeddings: Array<Embedding> = [];

  textEmbeddings.forEach((embedding, idx) => {
    embeddings[textIndices[idx]] = embedding as Embedding;
  });

  imageEmbeddings.forEach((embedding, idx) => {
    embeddings[imageIndices[idx]] = embedding as Embedding;
  });

  return embeddings;
}

/**
 * Check if a string is a base64 encoded image
 */
function isBase64Image(str: string): boolean {
  return /^data:image\/(jpeg|jpg|png|gif|webp|svg\+xml);base64,/.test(str);
}
/**
 * Generate embeddings for text inputs
 * @param values Array of text strings to embed
 * @returns Array of embeddings (number arrays)
 */
async function embedTexts(values: Array<string>) {
  const { tokenizer, textModel } = await initTextModels();

  const embeddings = [];

  // Process each text one by one
  for (const text of values) {
    // Tokenize the input text
    const textInputs = tokenizer([text], { padding: true, truncation: true });

    // Get embedding from the model
    const { text_embeds } = await textModel(textInputs);

    // Convert tensor data to array
    const embedding = Array.from(text_embeds.data) as Embedding;
    embeddings.push(embedding);
  }

  return embeddings;
}

/**
 * Generate embeddings for image inputs
 * @param imageUrls Array of image URLs or base64 data URIs
 * @returns Array of embeddings (number arrays)
 */
async function embedImages(imageUrls: string[]) {
  const { processor, visionModel } = await initVisionModels();

  const embeddings = [];

  // Process each image one by one
  for (const imageUrl of imageUrls) {
    // Load and process the image
    const image = isBase64Image(imageUrl)
      ? Buffer.from(imageUrl.split(",")[1], "base64")
      : await RawImage.read(imageUrl);
    const imageInputs = await processor(image);

    // Get embedding from the model
    const { image_embeds } = await visionModel(imageInputs);

    // Convert tensor data to array
    const embedding = Array.from(image_embeds.data);
    embeddings.push(embedding);
  }

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

// (async () => {
//   let imageProcessor = await AutoProcessor.from_pretrained(
//     "Xenova/clip-vit-base-patch16"
//   );
//   let visionModel = await CLIPVisionModelWithProjection.from_pretrained(
//     "Xenova/clip-vit-base-patch16",
//   );
//   let tokenizer = await AutoTokenizer.from_pretrained(
//     "Xenova/clip-vit-base-patch16"
//   );
//   let textModel = await CLIPTextModelWithProjection.from_pretrained(
//     "Xenova/clip-vit-base-patch16",
//   );

//   function cosineSimilarity(A, B) {
//     if (A.length !== B.length) throw new Error("A.length !== B.length");
//     let dotProduct = 0,
//       mA = 0,
//       mB = 0;
//     for (let i = 0; i < A.length; i++) {
//       dotProduct += A[i] * B[i];
//       mA += A[i] * A[i];
//       mB += B[i] * B[i];
//     }
//     mA = Math.sqrt(mA);
//     mB = Math.sqrt(mB);
//     let similarity = dotProduct / (mA * mB);
//     return similarity;
//   }

//   // get image embedding:
//   let image = await RawImage.read("https://i.imgur.com/8VVO2fs.jpeg");
//   let imageInputs = await imageProcessor(image);
//   let { image_embeds } = await visionModel(imageInputs);

//   // get text embedding:
//   let texts = ["cat"];
//   let textInputs = tokenizer(texts, { padding: true, truncation: true });
//   let { text_embeds } = await textModel(textInputs);

//   let similarity = cosineSimilarity(image_embeds.data, text_embeds.data);
//   console.log(similarity);
// })();
