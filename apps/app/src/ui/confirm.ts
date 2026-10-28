import { Alert } from "react-native";

/** Asks before a destructive action; resolves true when the user goes ahead. */
export function confirm(title: string, message: string, action: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Vazgeç", style: "cancel", onPress: () => resolve(false) },
      { text: action, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}
