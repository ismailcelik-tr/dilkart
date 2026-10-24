import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { searchKey } from "./searchKey";

const vectors: [string, string][] = JSON.parse(
  readFileSync(new URL("../../../../spec/search-key.json", import.meta.url), "utf8"),
);

describe("searchKey", () => {
  it.each(vectors)("%j → %j", (text, expected) => {
    expect(searchKey(text)).toBe(expected);
  });
});
