import { useLocalSearchParams } from "expo-router";

import { BulkAddScreen } from "@/features/cards/BulkAddScreen";

export default function BulkAdd() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BulkAddScreen deckId={id} />;
}
