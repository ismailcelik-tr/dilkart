import { useLocalSearchParams } from "expo-router";

import { MatchScreen } from "@/features/study/MatchScreen";

export default function Match() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  return <MatchScreen deckId={deckId} />;
}
