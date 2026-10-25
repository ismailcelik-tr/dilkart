import type { Library } from "@dilkart/core";
import { Alert } from "react-native";

/** Asks first: a deck takes its cards with it (plan section 16, stage 4 decision). */
export function confirmRemoveDeck(lib: Library, deck: { id: string; name: string }, cardCount: number, onDone: () => void) {
  Alert.alert("Desteyi sil", `${deck.name} ve içindeki ${cardCount} kart silinecek.`, [
    { text: "Vazgeç", style: "cancel" },
    {
      text: "Sil",
      style: "destructive",
      onPress: async () => {
        await lib.removeDeck(deck.id);
        onDone();
      },
    },
  ]);
}
