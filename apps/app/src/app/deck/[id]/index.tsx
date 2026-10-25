import { useLocalSearchParams } from "expo-router";

import { DeckScreen } from "@/features/decks/DeckScreen";

export default function Deck() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DeckScreen deckId={id} />;
}
