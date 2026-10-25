// Hermes has no Web Crypto; core's uuidv7 needs crypto.getRandomValues.
import { getRandomValues } from "expo-crypto";

if (globalThis.crypto?.getRandomValues === undefined) {
  Object.defineProperty(globalThis, "crypto", {
    value: { ...globalThis.crypto, getRandomValues },
    configurable: true,
  });
}
