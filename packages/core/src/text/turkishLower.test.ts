import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { turkishLower } from "./turkishLower";

const vectors: [string, string][] = JSON.parse(
  readFileSync(new URL("../../../../spec/turkish-lower.json", import.meta.url), "utf8"),
);

describe("turkishLower", () => {
  it.each(vectors)("%j → %j", (text, expected) => {
    expect(turkishLower(text)).toBe(expected);
  });
});
