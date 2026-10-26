import { DEFAULT_SETTINGS, type Accent } from "@dilkart/core";
import type { Voice } from "expo-speech";
import { useEffect, useState } from "react";

import { englishVoices, pickVoice, say } from "@/drivers/speech";

import { useSettings } from "./library";

/** `available` is undefined until the voice list and the accent load. */
export function useSpeech() {
  const settings = useSettings();
  const [loaded, setLoaded] = useState<{ voices: Voice[]; accent: Accent }>();

  useEffect(() => {
    const voices = englishVoices().catch((): Voice[] => []);
    void Promise.all([voices, settings.get()]).then(([v, s]) => setLoaded({ voices: v, accent: s.accent }));
  }, [settings]);

  const accent = loaded?.accent ?? DEFAULT_SETTINGS.accent;
  const voice = loaded && pickVoice(loaded.voices, accent);
  return {
    available: loaded === undefined ? undefined : loaded.voices.length > 0,
    speak: (text: string) => say(text, accent, voice),
  };
}
