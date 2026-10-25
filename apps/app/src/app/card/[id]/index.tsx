import { useLocalSearchParams } from "expo-router";

import { CardFormScreen } from "@/features/cards/CardFormScreen";

export default function EditCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CardFormScreen cardId={id} />;
}
