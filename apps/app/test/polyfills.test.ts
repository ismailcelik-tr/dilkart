import { uuidv7 } from "@dilkart/core";
import { webcrypto as mockWebcrypto } from "node:crypto";

jest.mock("expo-crypto", () => ({
  getRandomValues: <T extends Uint8Array>(a: T) => mockWebcrypto.getRandomValues(a),
}));

it("provides crypto.getRandomValues on runtimes without Web Crypto (Hermes)", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
  try {
    expect(() => uuidv7()).toThrow();
    jest.isolateModules(() => require("@/services/polyfills"));
    expect(uuidv7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  } finally {
    if (original) {
      Object.defineProperty(globalThis, "crypto", original);
    }
  }
});
