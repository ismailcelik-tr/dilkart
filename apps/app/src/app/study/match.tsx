import { SessionKind } from "@dilkart/core";
import { useLocalSearchParams } from "expo-router";

import { MatchScreen } from "@/features/study/MatchScreen";

export default function Match() {
  const { deckId, kind } = useLocalSearchParams<{ deckId?: string; kind?: string }>();
  return <MatchScreen deckId={deckId} kind={kind === SessionKind.Weak ? SessionKind.Weak : SessionKind.Free} />;
}
