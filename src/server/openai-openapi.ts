import { z } from "@hono/zod-openapi";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import {
  connectToBrowser,
  goToGemini,
  selectGeminiModel,
  submitGeminiPrompt,
  getGeminiResponse,
} from "../services/gemini";
import { buildPrompt } from "../context/messages";
import { getBrowserWSUrl } from "utils/browserWsUrl";

const MessageSchema = z.object({
  role: z.string().openapi({ example: "user" }),
  content: z.string().openapi({ example: "Hello!" }),
  refusal: z.nullable(z.string()).optional().openapi({ example: null }),
  annotations: z.array(z.any()).optional().openapi({ example: [] }),
});

const ChatRequestSchema = z
  .object({
    model: z.string().openapi({ example: "gpt-4.1" }),
    messages: z.array(MessageSchema),
  })
  .openapi("ChatCompletionRequest");

const ChatResponseSchema = z
  .object({
    id: z.string().openapi({ example: "chatcmpl-mock" }),
    object: z.string().openapi({ example: "chat.completion" }),
    created: z.number().openapi({ example: 1620000000 }),
    model: z.string().openapi({ example: "gemini-2.5-flash" }),
    choices: z.array(
      z.object({
        index: z.number(),
        message: MessageSchema.extend({
          role: z.literal("assistant"),
          content: z.string(),
          refusal: z.nullable(z.string()).optional(),
          annotations: z.array(z.any()).optional(),
        }),
        logprobs: z.nullable(z.any()).optional(),
        finish_reason: z.string(),
      })
    ),
    usage: z.object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
      prompt_tokens_details: z
        .object({
          cached_tokens: z.number(),
          audio_tokens: z.number(),
        })
        .optional(),
      completion_tokens_details: z
        .object({
          reasoning_tokens: z.number(),
          audio_tokens: z.number(),
          accepted_prediction_tokens: z.number(),
          rejected_prediction_tokens: z.number(),
        })
        .optional(),
    }),
    service_tier: z.string().optional(),
  })
  .openapi("ChatCompletionResponse");

const app = new OpenAPIHono();

// Supported Gemini models
const SUPPORTED_MODELS = [
  {
    id: "gemini-2.5-flash",
    object: "model",
    created: 1686935002,
    owned_by: "organization-owner",
  },
  {
    id: "gemini-2.5-pro",
    object: "model",
    created: 1686935002,
    owned_by: "organization-owner",
  },
  {
    id: "gemini-personalization-preview",
    object: "model",
    created: 1686935002,
    owned_by: "openai",
  },
];

app.openapi(
  createRoute({
    method: "get",
    path: "/v1/models",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              object: z.literal("list"),
              data: z.array(
                z.object({
                  id: z.string(),
                  object: z.literal("model"),
                  created: z.number(),
                  owned_by: z.string(),
                })
              ),
            }),
          },
        },
        description: "List of supported models",
      },
    },
  }),
  async (c) => {
    return c.json({ object: "list", data: SUPPORTED_MODELS }) as never;
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/v1/chat/completions",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.any(),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ChatResponseSchema,
          },
        },
        description: "Mock OpenAI chat completion response",
      },
    },
  }),
  async (c) => {
    const body = await c.req.valid("json");
    console.log(`Received request:`, body);
    let response;

    const wsUrl = process.env.CHROME_WS_URL || (await getBrowserWSUrl());
    if (!wsUrl) {
      throw new Error("Could not get WebSocket URL");
    }
    try {
      const browser = await connectToBrowser(wsUrl);
      const { page, eye } = await goToGemini(browser);
      const prompt = buildPrompt(body.messages);

      await selectGeminiModel(eye, body.model || "gemini-2.5-flash");
      await submitGeminiPrompt(eye, prompt);
      const geminiResponse = await getGeminiResponse(eye, page);
      // const geminiResponse = ''

      response = {
        id: "chatcmpl-gemini",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "gemini",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content:
                geminiResponse ||
                "Gemini response captured, but not available.",
              refusal: null,
              annotations: [],
            },
            logprobs: null,
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: prompt.length,
          completion_tokens: 0,
          total_tokens: prompt.length,
          prompt_tokens_details: { cached_tokens: 0, audio_tokens: 0 },
          completion_tokens_details: {
            reasoning_tokens: 0,
            audio_tokens: 0,
            accepted_prediction_tokens: 0,
            rejected_prediction_tokens: 0,
          },
        },
        service_tier: "default",
      };
      console.log("Gemini automation response:", response);
      return c.json(response) as never;
    } catch (err) {
      console.log("Gemini automation error:", err);
      response = {
        id: "chatcmpl-gemini-error",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "gemini",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: `Gemini error: ${err}`,
              refusal: null,
              annotations: [],
            },
            logprobs: null,
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          prompt_tokens_details: { cached_tokens: 0, audio_tokens: 0 },
          completion_tokens_details: {
            reasoning_tokens: 0,
            audio_tokens: 0,
            accepted_prediction_tokens: 0,
            rejected_prediction_tokens: 0,
          },
        },
        service_tier: "default",
      };

      console.error("Gemini automation error response:", response);
      return c.json(response) as never;
    }
  }
);

app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Mock OpenAI API",
  },
});

// Catch-all route for all other requests
app.all("*", (c) => {
  console.log(`Unhandled request: ${c.req.method} ${c.req.url}`);
  return c.json(
    {
      error: "Endpoint not found",
      path: c.req.url,
      method: c.req.method,
    },
    404
  );
});

// Export fetch handler for edge/serverless environments
// To run locally, use a compatible runtime (e.g., Bun, Deno, Vercel, Cloudflare, or Node.js with an adapter)
export default app;
export const fetch = app.fetch;
