// Device preferences live in expo-sqlite's native kv-store; tests keep them in memory.
const mockValues = new Map<string, string>();

jest.mock("expo-sqlite/kv-store", () => ({
  Storage: {
    getItem: async (k: string) => mockValues.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockValues.set(k, v),
  },
}));

beforeEach(() => mockValues.clear());
