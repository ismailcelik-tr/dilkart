import { IconButton } from "@/ui/components";

/** Speaker beside English text; the screen passes `useSpeech().speak`. */
export function ListenButton({ text, onSpeak }: { text: string; onSpeak: (text: string) => void }) {
  return <IconButton icon="speaker.wave.2.fill" label={`Dinle: ${text}`} onPress={() => onSpeak(text)} />;
}
