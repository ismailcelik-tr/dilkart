import "@/services/polyfills";

import { router, Stack } from "expo-router";
import { Pressable, Text } from "react-native";

import { LibraryProvider } from "@/services/library";

// Deep links open above the deck list, so back always has somewhere to go.
export const unstable_settings = { anchor: "index" };

export default function RootLayout() {
  return (
    <LibraryProvider>
      <Stack
        screenOptions={({ route }) => ({
          headerRight: route.name === "dictionary" ? undefined : () => <DictionaryButton />,
        })}
      >
        <Stack.Screen name="index" options={{ title: "Destelerim" }} />
        <Stack.Screen name="deck/new" options={{ title: "Yeni deste", presentation: "modal" }} />
        <Stack.Screen name="deck/[id]/index" options={{ title: "" }} />
        <Stack.Screen name="deck/[id]/rename" options={{ title: "Yeniden adlandır", presentation: "modal" }} />
        <Stack.Screen name="card/new" options={{ title: "Yeni kart", presentation: "modal" }} />
        <Stack.Screen name="card/[id]/index" options={{ title: "Kartı düzenle" }} />
        <Stack.Screen name="card/[id]/move" options={{ title: "Desteye taşı", presentation: "modal" }} />
        <Stack.Screen name="study/index" options={{ title: "Çalış" }} />
        <Stack.Screen name="study/session" options={{ title: "Çalışma" }} />
        <Stack.Screen name="study/match" options={{ title: "Eşleştirme" }} />
        <Stack.Screen
          name="dictionary"
          options={{ title: "Sözlük", presentation: "formSheet", sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true }}
        />
        <Stack.Screen name="about/licenses" options={{ title: "Lisanslar ve kaynaklar" }} />
        <Stack.Screen name="account/index" options={{ title: "Hesap" }} />
        <Stack.Screen name="account/sign-up" options={{ title: "Hesap oluştur" }} />
        <Stack.Screen name="account/sign-in" options={{ title: "Giriş yap" }} />
        <Stack.Screen name="account/verify" options={{ title: "Kodu gir" }} />
        <Stack.Screen name="account/forgot" options={{ title: "Şifremi unuttum" }} />
        <Stack.Screen name="account/new-password" options={{ title: "Yeni şifre" }} />
        <Stack.Screen name="account/adopt" options={{ title: "Bu cihazdaki kartlar", presentation: "modal" }} />
      </Stack>
    </LibraryProvider>
  );
}

function DictionaryButton() {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push("/dictionary")} hitSlop={8}>
      <Text style={{ fontSize: 17, color: "#007AFF" }}>Sözlük</Text>
    </Pressable>
  );
}
