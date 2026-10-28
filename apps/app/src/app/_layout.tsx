import "@/services/polyfills";

import {
  DarkTheme,
  DefaultTheme,
  router,
  Stack,
  ThemeProvider,
} from "expo-router";
import { Appearance, Pressable, Text, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { LibraryProvider } from "@/services/library";
import { savedScheme } from "@/services/prefs";
import { useTheme } from "@/ui/theme";

// Deep links open above the deck list, so back always has somewhere to go.
export const unstable_settings = { anchor: "index" };

const saved = savedScheme();
if (saved !== undefined) {
  Appearance.setColorScheme(saved);
}

export default function RootLayout() {
  // Without it the native header stays light in dark mode: black titles on a dark bar.
  const scheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <LibraryProvider>
          <Stack
            screenOptions={({ route }) => ({
              headerRight:
                route.name === "dictionary"
                  ? undefined
                  : () => <DictionaryButton />,
            })}
          >
            <Stack.Screen name="index" options={{ title: "Destelerim" }} />
            <Stack.Screen name="deck/new" options={{ title: "Yeni deste" }} />
            <Stack.Screen name="deck/[id]/index" options={{ title: "" }} />
            <Stack.Screen
              name="deck/[id]/rename"
              options={{ title: "Yeniden adlandır" }}
            />
            <Stack.Screen name="card/new" options={{ title: "Yeni kart" }} />
            <Stack.Screen
              name="card/[id]/index"
              options={{ title: "Kartı düzenle" }}
            />
            <Stack.Screen
              name="card/[id]/move"
              options={{ title: "Desteye taşı" }}
            />
            <Stack.Screen name="study/index" options={{ title: "Çalış" }} />
            <Stack.Screen name="study/session" options={{ title: "Çalışma" }} />
            <Stack.Screen
              name="study/match"
              options={{ title: "Eşleştirme" }}
            />
            <Stack.Screen
              name="dictionary"
              options={{
                title: "Sözlük",
                presentation: "formSheet",
                sheetAllowedDetents: [0.75, 1],
                sheetGrabberVisible: true,
              }}
            />
            <Stack.Screen name="about/index" options={{ title: "Hakkında" }} />
            <Stack.Screen name="settings/index" options={{ title: "Ayarlar" }} />
            <Stack.Screen name="settings/choose" options={{ title: "" }} />
            <Stack.Screen name="weak/suggestions" options={{ title: "Zayıf kelime önerileri" }} />
            <Stack.Screen name="stats/index" options={{ title: "İstatistikler" }} />
            <Stack.Screen name="account/index" options={{ title: "Hesap" }} />
            <Stack.Screen
              name="account/sign-up"
              options={{ title: "Hesap oluştur" }}
            />
            <Stack.Screen
              name="account/sign-in"
              options={{ title: "Giriş yap" }}
            />
            <Stack.Screen
              name="account/verify"
              options={{ title: "Kodu gir" }}
            />
            <Stack.Screen
              name="account/forgot"
              options={{ title: "Şifremi unuttum" }}
            />
            <Stack.Screen
              name="account/new-password"
              options={{ title: "Yeni şifre" }}
            />
            <Stack.Screen
              name="account/adopt"
              options={{ title: "Bu cihazdaki kartlar" }}
            />
          </Stack>
        </LibraryProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function DictionaryButton() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/dictionary")}
      hitSlop={8}
      style={{ paddingHorizontal: 12 }}
    >
      <Text style={{ fontSize: 17, color: theme.tint }}>Sözlük</Text>
    </Pressable>
  );
}
