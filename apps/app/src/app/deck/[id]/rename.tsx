import { useLocalSearchParams } from "expo-router";

import { DeckNameScreen } from "@/features/decks/DeckNameScreen";

export default function RenameDeck() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DeckNameScreen deckId={id} />;
}
