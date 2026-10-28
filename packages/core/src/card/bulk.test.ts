import { describe, expect, it } from "vitest";

import { planBulk, parseBulk } from "./bulk";
import { CardError } from "./card";

describe("parseBulk", () => {
  it("reads semicolon fields, comma meanings and trims", () => {
    expect(parseBulk(" go ; gitmek, yürümek ; Let's go. ; Gidelim. ")).toEqual([
      {
        line: 1,
        draft: { front: "go", meanings: [{ tr: "gitmek" }, { tr: "yürümek" }], exampleEn: "Let's go.", exampleTr: "Gidelim." },
      },
    ]);
  });

  it("prefers tabs, so pasted spreadsheet columns keep their semicolons", () => {
    expect(parseBulk("see\tgörmek; anlamak")).toEqual([{ line: 1, draft: { front: "see", meanings: [{ tr: "görmek; anlamak" }] } }]);
  });

  it("skips blank lines but keeps line numbers", () => {
    expect(parseBulk("\ngo; gitmek\n\n; anlam\nrun").map((l) => l.line)).toEqual([2, 4, 5]);
  });

  it("reports missing front and meaning", () => {
    expect(parseBulk("; anlam\nrun")).toEqual([
      { line: 1, errors: [CardError.EmptyFront] },
      { line: 2, errors: [CardError.NoMeaning] },
    ]);
  });
});

describe("planBulk", () => {
  const go = { id: "c1", deckId: "d1", front: "Go", meanings: [{ tr: "gitmek" }] };

  it("adds new cards and skips existing ones and repeats", () => {
    const plan = planBulk(parseBulk("go; gitmek\nrun; koşmak\n; x\nrun; akmak"), [go]);
    expect(plan.add.map((d) => d.front)).toEqual(["run"]);
    expect(plan.invalid).toEqual([{ line: 3, errors: [CardError.EmptyFront] }]);
    expect(plan.duplicates).toEqual([
      { line: 1, front: "go", existing: go },
      { line: 4, front: "run", sameAsLine: 2 },
    ]);
  });
});
