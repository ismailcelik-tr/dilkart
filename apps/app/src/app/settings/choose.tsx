import { useLocalSearchParams } from "expo-router";

import { ChooseScreen } from "@/features/settings/ChooseScreen";
import { isField } from "@/features/settings/choices";
import { Empty } from "@/ui/components";

export default function Choose() {
  const { field } = useLocalSearchParams<{ field: string }>();
  return isField(field) ? <ChooseScreen field={field} /> : <Empty text="Ayar bulunamadı" />;
}
