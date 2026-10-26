import { router } from "expo-router";

import { Group, Row } from "@/ui/components";

/** Hidden when both counts are zero. */
export function WeakStrip({ weak, suggested }: { weak: number; suggested: number }) {
  if (weak === 0 && suggested === 0) {
    return null;
  }

  return (
    <Group>
      {weak > 0 && (
        <Row
          title={`${weak} zayıf kelime`}
          subtitle="Çalış"
          onPress={() => router.push({ pathname: "/study", params: { weak: "1" } })}
        />
      )}
      {suggested > 0 && (
        <Row title={`${suggested} yeni öneri`} subtitle="Gözden geçir" onPress={() => router.push("/weak/suggestions")} />
      )}
    </Group>
  );
}
