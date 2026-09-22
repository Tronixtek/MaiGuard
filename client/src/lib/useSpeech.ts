import { useCallback, useEffect, useRef, useState } from "react";

// The Web Speech API is not in TypeScript's DOM lib yet; this is the slice we use.
interface Recognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

const RecognitionCtor: (new () => Recognition) | undefined =
  typeof window !== "undefined"
    ? ((window as unknown as Record<string, unknown>).SpeechRecognition ??
        (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognition) | undefined
    : undefined;

/**
 * Browser speech-to-text. It only transcribes; structuring happens on the server.
 * `onFinal` receives each finished phrase, `interim` is the phrase in progress.
 */
export function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => rec.current?.stop(), []);

  const start = useCallback(() => {
    if (!RecognitionCtor) return;
    setError(null);
    const r = new RecognitionCtor();
    r.lang = "en-NG";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const text = res[0]!.transcript;
        if (res.isFinal) onFinalRef.current(text.trim());
        else pending += text;
      }
      setInterim(pending);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") setError("Microphone permission was denied. You can type the report instead.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError(`Speech recognition stopped (${e.error}). You can type instead.`);
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    rec.current = r;
    r.start();
    setListening(true);
  }, []);

  useEffect(() => () => rec.current?.stop(), []);

  return { supported: Boolean(RecognitionCtor), listening, interim, error, start, stop };
}
