import { z } from "zod";
import { withFallback } from "./client.js";
import { LANGUAGE_CODES, languageName, type Language } from "../lib/languages.js";
import type { AlertTranslation } from "../types.js";

const RULES = `You translate community safety messages for MaiGuard, in Nigeria.

- Translate exactly what is written. Never add, soften or drop a fact, a place name or an instruction.
- Keep road, place and people's names as they are; do not translate them.
- Write the way people actually speak the language, plainly, for someone reading a basic phone in a hurry.
- Nigerian Pidgin means everyday Nigerian Pidgin English, not formal English.
- Keep it about the same length, and keep any phone numbers unchanged.`;

const TranslationSchema = z.object({ what: z.string(), where: z.string(), action: z.string() });

/** Translate the three lines of an alert into every other language. */
export async function translateAlert(
  alert: { what: string; where: string; action: string },
  from: Language,
): Promise<Partial<Record<Language, AlertTranslation>>> {
  const targets = LANGUAGE_CODES.filter((code) => code !== from);
  const results = await Promise.all(
    targets.map(async (target) => {
      const translation = await withFallback(
        `translate:${target}`,
        (provider) =>
          provider.generate({
            system: RULES,
            user: `Translate from ${languageName(from)} into ${languageName(target)}.\n\nwhat: ${alert.what}\nwhere: ${alert.where}\naction: ${alert.action || "(none)"}`,
            schema: TranslationSchema,
            maxTokens: 1500,
          }),
        // Without a model there is no translation; recipients get the original.
        () => undefined as unknown as AlertTranslation,
      );
      return [target, translation] as const;
    }),
  );
  return Object.fromEntries(results.filter(([, value]) => value?.what)) as Partial<Record<Language, AlertTranslation>>;
}

const TextSchema = z.object({ text: z.string() });

/** Translate one message, keeping its line breaks and *bold* markers. */
export async function translateText(text: string, to: Language): Promise<string> {
  if (to === "en") return text;
  return withFallback(
    `translate-text:${to}`,
    async (provider) => {
      const out = await provider.generate({
        system: `${RULES}\n- Keep the line breaks, bullet points and *bold* markers exactly where they are.`,
        user: `Translate into ${languageName(to)}:\n\n${text}`,
        schema: TextSchema,
        maxTokens: 2000,
      });
      return out.text || text;
    },
    () => text,
  );
}
