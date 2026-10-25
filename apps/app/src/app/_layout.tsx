import "@/services/polyfills";

import { Stack } from "expo-router";

import { LibraryProvider } from "@/services/library";

// Deep links open above the deck list, so back always has somewhere to go.
export const unstable_settings = { anchor: "index" };

export default function RootLayout() {
  return (
    <LibraryProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Destelerim" }} />
        <Stack.Screen name="deck/new" options={{ title: "Yeni deste", presentation: "modal" }} />
        <Stack.Screen name="deck/[id]/index" options={{ title: "" }} />
        <Stack.Screen name="deck/[id]/rename" options={{ title: "Yeniden adlandır", presentation: "modal" }} />
        <Stack.Screen name="card/new" options={{ title: "Yeni kart", presentation: "modal" }} />
        <Stack.Screen name="card/[id]/index" options={{ title: "Kartı düzenle" }} />
        <Stack.Screen name="card/[id]/move" options={{ title: "Desteye taşı", presentation: "modal" }} />
      </Stack>
    </LibraryProvider>
  );
}
