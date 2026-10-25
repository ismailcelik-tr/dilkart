import { describe, expect, it } from "vitest";

import { CardError, findDuplicate, validate } from "./card";

describe("validate", () => {
  it("trims fields and drops empty meanings", () => {
    expect(validate({ front: "  give up ", meanings: [{ tr: " vazgeçmek " }, { tr: "  " }], usageLabel: " " })).toEqual({
      ok: true,
      card: { front: "give up", meanings: [{ tr: "vazgeçmek" }], usageLabel: undefined },
    });
  });

  it("requires a front and a meaning", () => {
    expect(validate({ front: " ", meanings: [{ tr: "" }] })).toEqual({
      ok: false,
      errors: [CardError.EmptyFront, CardError.NoMeaning],
    });
  });

  it("keeps the part of speech", () => {
    const result = validate({ front: "run", meanings: [{ tr: "koşmak", pos: "verb" }] });
    expect(result.ok && result.card.meanings).toEqual([{ tr: "koşmak", pos: "verb" }]);
  });
});

describe("findDuplicate", () => {
  const cards = [
    { id: "1", front: "Bank", usageLabel: "finans", meanings: [{ tr: "banka" }] },
    { id: "2", front: "bank", usageLabel: "nehir", meanings: [{ tr: "kıyı" }] },
    { id: "3", front: "run", dictSenseId: "42", meanings: [{ tr: "koşmak" }] },
  ];

  it("matches the same dictionary sense", () => {
    expect(findDuplicate({ front: "running", dictSenseId: "42", meanings: [] }, cards)?.id).toBe("3");
  });

  it("does not match another sense of the same word", () => {
    expect(findDuplicate({ front: "run", dictSenseId: "43", meanings: [] }, cards)).toBeUndefined();
  });

  it("matches a manual card by normalized front and usage label", () => {
    expect(findDuplicate({ front: " BANK! ", usageLabel: "Nehir", meanings: [] }, cards)?.id).toBe("2");
    expect(findDuplicate({ front: "bank", meanings: [] }, cards)).toBeUndefined();
  });
});
