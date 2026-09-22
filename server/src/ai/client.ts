import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import type { AiEngine } from "../types.js";

/**
 * One call shape for every provider: a system prompt, a user message and a
 * zod schema in, a validated object out. Gemini is used when GEMINI_API_KEY is
 * set, otherwise Claude when ANTHROPIC_API_KEY is set, otherwise callers use
 * the rule-based fallback. The guardrails after each call are the same for all.
 */
export interface StructuredRequest<T extends z.ZodType> {
  system: string;
  user: string;
  schema: T;
  maxTokens: number;
}

interface Provider {
  engine: Exclude<AiEngine, "fallback">;
  /** The model that answered most recently. */
  model: string;
  generate<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>>;
}

/** Tried in order; a busy or failing model hands over to the next before the rule-based fallback. */
const GEMINI_MODELS = [process.env.GEMINI_MODEL || "gemini-3.1-flash-lite", "gemini-3-flash-preview"];

function geminiProvider(apiKey: string): Provider {
  const ai = new GoogleGenAI({ apiKey });
  const models = [...new Set(GEMINI_MODELS)];
  const provider: Provider = {
    engine: "gemini",
    model: models[0]!,
    async generate(req) {
      const { $schema: _drop, ...jsonSchema } = z.toJSONSchema(req.schema) as Record<string, unknown>;
      let lastError: unknown;
      for (const model of models) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: req.user,
            config: {
              systemInstruction: req.system,
              responseMimeType: "application/json",
              responseJsonSchema: jsonSchema,
              maxOutputTokens: req.maxTokens,
              // Routing and matching are short, well-specified tasks; keep latency low.
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              abortSignal: AbortSignal.timeout(12_000),
            },
          });
          const block = response.promptFeedback?.blockReason;
          if (block) throw new Error(`Gemini blocked the request (${block})`);
          if (!response.text) throw new Error(`no output (finish reason ${response.candidates?.[0]?.finishReason ?? "unknown"})`);
          const parsed = req.schema.parse(JSON.parse(response.text));
          provider.model = model;
          return parsed;
        } catch (err) {
          lastError = err;
          console.warn(`[ai] ${model}: ${String((err as Error).message).slice(0, 120)}`);
        }
      }
      throw lastError;
    },
  };
  return provider;
}

function anthropicProvider(): Provider {
  const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5";
  return {
    engine: "claude",
    model,
    async generate(req) {
      const response = await client.messages.parse({
        model,
        max_tokens: req.maxTokens,
        system: req.system,
        output_config: { effort: "low", format: zodOutputFormat(req.schema) },
        messages: [{ role: "user", content: req.user }],
      });
      if (response.stop_reason === "refusal") throw new Error("model declined");
      if (!response.parsed_output) throw new Error("no structured output");
      return response.parsed_output as z.infer<typeof req.schema>;
    },
  };
}

let provider: Provider | null | undefined;

/** Null when no key is configured; callers then use the deterministic fallback. */
export function getProvider(): Provider | null {
  if (provider === undefined) {
    if (process.env.GEMINI_API_KEY) provider = geminiProvider(process.env.GEMINI_API_KEY);
    else if (process.env.ANTHROPIC_API_KEY) provider = anthropicProvider();
    else provider = null;
  }
  return provider;
}

export const activeEngine = (): AiEngine => getProvider()?.engine ?? "fallback";
export const activeModel = (): string | null => getProvider()?.model ?? null;

/**
 * Run the model path and fall back to the deterministic path on any failure,
 * so a slow network or an outage never leaves anyone without an answer.
 */
export async function withFallback<T>(label: string, viaModel: (p: Provider) => Promise<T>, fallback: () => T): Promise<T> {
  const p = getProvider();
  if (!p) return fallback();
  try {
    return await viaModel(p);
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? ` ${err.status ?? ""}` : "";
    console.warn(`[ai:${label}] ${p.engine}${status}: ${(err as Error).message}; using fallback`);
    return fallback();
  }
}
