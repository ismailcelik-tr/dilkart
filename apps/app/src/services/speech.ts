import type { Voice } from "expo-speech";
import { useEffect, useState } from "react";

import { Accent, englishVoices, pickVoice, say } from "@/drivers/speech";

// user_settings.tts_accent becomes editable in stage 8.
const DEFAULT_ACCENT = Accent.US;

/** `available` is undefined until the voice list loads. */
export function useSpeech(accent: Accent = DEFAULT_ACCENT) {
  const [voices, setVoices] = useState<Voice[]>();

  useEffect(() => {
    englishVoices().then(setVoices, () => setVoices([]));
  }, []);

  const voice = voices && pickVoice(voices, accent);
  return {
    available: voices === undefined ? undefined : voices.length > 0,
    speak: (text: string) => say(text, accent, voice),
  };
}
