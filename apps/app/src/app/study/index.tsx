import { useLocalSearchParams } from "expo-router";

import { StudyStartScreen } from "@/features/study/StudyStartScreen";

export default function StudyStart() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  return <StudyStartScreen deckId={deckId} />;
}
