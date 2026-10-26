import { useLocalSearchParams } from "expo-router";

import { StudyStartScreen } from "@/features/study/StudyStartScreen";

export default function StudyStart() {
  const { deckId, weak } = useLocalSearchParams<{ deckId?: string; weak?: string }>();
  return <StudyStartScreen deckId={deckId} weak={weak === "1"} />;
}
