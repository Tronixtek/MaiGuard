/** The languages MaiGuard speaks. English is the fallback everywhere. */
export const LANGUAGES = {
  en: { label: "English", native: "English" },
  ha: { label: "Hausa", native: "Hausa" },
  pcm: { label: "Nigerian Pidgin", native: "Pidgin" },
  yo: { label: "Yoruba", native: "Yorùbá" },
  ig: { label: "Igbo", native: "Igbo" },
} as const;

export type Language = keyof typeof LANGUAGES;

export const LANGUAGE_CODES = Object.keys(LANGUAGES) as [Language, ...Language[]];

export const isLanguage = (value: unknown): value is Language => typeof value === "string" && value in LANGUAGES;

export const languageName = (code: Language) => LANGUAGES[code].label;

/** Languages an alert is translated into when it is published. */
export const TRANSLATION_TARGETS = LANGUAGE_CODES;
