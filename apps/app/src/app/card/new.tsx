import { useLocalSearchParams } from "expo-router";

import { CardFormScreen } from "@/features/cards/CardFormScreen";

export default function NewCard() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  return <CardFormScreen deckId={deckId} />;
}
