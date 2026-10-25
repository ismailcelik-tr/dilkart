import { SessionKind, type Module } from "@dilkart/core";
import { useLocalSearchParams } from "expo-router";

import { StudySessionScreen } from "@/features/study/StudySessionScreen";

export default function StudySession() {
  const p = useLocalSearchParams<{ deckId?: string; module: string; kind: string }>();
  const kind = p.kind === SessionKind.Free ? SessionKind.Free : SessionKind.Review;
  return <StudySessionScreen deckId={p.deckId} module={Number(p.module) as Module} kind={kind} />;
}
