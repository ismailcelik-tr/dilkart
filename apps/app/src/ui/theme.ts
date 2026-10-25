import { useColorScheme } from "react-native";

// iOS system colors; PlatformColor would not work on the web target.
const LIGHT = {
  background: "#F2F2F7",
  surface: "#FFFFFF",
  text: "#000000",
  secondary: "#6E6E73",
  tint: "#007AFF",
  danger: "#FF3B30",
  separator: "#C6C6C8",
};

const DARK: typeof LIGHT = {
  background: "#000000",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  secondary: "#98989F",
  tint: "#0A84FF",
  danger: "#FF453A",
  separator: "#38383A",
};

export type Theme = typeof LIGHT;

export const SPACE = 16;
export const RADIUS = 10;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}
