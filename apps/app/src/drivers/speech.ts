import { getAvailableVoicesAsync, speak, stop, VoiceQuality, type Voice } from "expo-speech";

export enum Accent {
  US = "en-US",
  GB = "en-GB",
}

// Android reports "en_US".
const languageOf = (v: Voice) => v.language.replace("_", "-").toLowerCase();

export async function englishVoices(): Promise<Voice[]> {
  return (await getAvailableVoicesAsync()).filter((v) => languageOf(v).startsWith("en"));
}

/** Best voice for the accent; any English voice when the accent has none. */
export function pickVoice(voices: Voice[], accent: Accent): Voice | undefined {
  const own = voices.filter((v) => languageOf(v) === accent.toLowerCase());
  return own.find((v) => v.quality === VoiceQuality.Enhanced) ?? own[0] ?? voices[0];
}

export function say(text: string, accent: Accent, voice?: Voice) {
  void stop();
  speak(text, { language: accent, voice: voice?.identifier });
}
