import { useLocalSearchParams } from "expo-router";

import { MoveCardScreen } from "@/features/cards/MoveCardScreen";

export default function MoveCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MoveCardScreen cardId={id} />;
}
