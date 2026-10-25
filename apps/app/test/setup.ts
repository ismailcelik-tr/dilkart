// Gesture and animation libraries need native code; tests render the swipe actions directly.
import "react-native-gesture-handler/jestSetup";

jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  const methods = { close: () => undefined, openLeft: () => undefined, openRight: () => undefined, reset: () => undefined };
  return {
    __esModule: true,
    default: ({
      children,
      renderRightActions,
      childrenContainerStyle,
    }: {
      children: unknown;
      renderRightActions?: (...args: unknown[]) => unknown;
      childrenContainerStyle?: unknown;
    }) =>
      createElement(
        View,
        null,
        createElement(View, { testID: "swipe-row", style: childrenContainerStyle }, children),
        renderRightActions?.(undefined, undefined, methods),
      ),
  };
});

// Device preferences live in expo-sqlite's native kv-store; tests keep them in memory.
const mockValues = new Map<string, string>();

jest.mock("expo-sqlite/kv-store", () => ({
  Storage: {
    getItem: async (k: string) => mockValues.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockValues.set(k, v),
    getItemSync: (k: string) => mockValues.get(k) ?? null,
  },
}));

beforeEach(() => mockValues.clear());
