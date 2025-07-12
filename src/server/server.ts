import app from "./openai-openapi";
import { serve } from "@hono/node-server";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

serve({ fetch: app.fetch, port: PORT });
console.log(`Mock OpenAI API server running on http://localhost:${PORT}`);
