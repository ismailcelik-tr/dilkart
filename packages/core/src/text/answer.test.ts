import { describe, expect, it } from "vitest";

import { checkAnswer, Verdict } from "./answer";

describe("checkAnswer", () => {
  it.each([
    ["go", ["go"]],
    ["  Go ", ["go"]],
    ["GO!", ["go"]],
    ["Give  up", ["give up"]],
    ["cafe", ["café"]],
    ["café", ["cafe"]],
    ["sogan", ["soğan"]],
    ["to go", ["go"]],
    ["go", ["to go"]],
    ["well known", ["well-known"]],
    ["dont", ["don't"]],
    ["I", ["I"]],
    ["misafir", ["konuk, misafir"]],
    ["konuk", ["konuk; misafir"]],
    ["run", ["go", "run"]],
  ])("%j is correct for %j", (input, accepted) => {
    expect(checkAnswer(input, accepted).verdict).toBe(Verdict.Correct);
  });

  it.each([
    ["teh", "the"],
    ["goo", "go"],
    ["gp", "go"],
    ["pencel", "pencil"],
    ["recieve", "receive"],
    ["kitchin", "kitchen"],
    ["kichin", "kitchen"],
    ["beautful", "beautiful"],
    ["beutful", "beautiful"],
    ["giv up", "give up"],
    ["acommodate", "accommodate"],
  ])("%j is almost %j", (input, expected) => {
    expect(checkAnswer(input, [expected])).toEqual({ verdict: Verdict.Almost, expected });
  });

  it.each([
    ["", "go"],
    ["   ", "go"],
    ["come", "go"],
    ["pensel", "pencil"],
    ["hous", "horse"],
    ["bautfl", "beautiful"],
    ["give", "give up"],
  ])("%j is wrong for %j", (input, expected) => {
    expect(checkAnswer(input, [expected]).verdict).toBe(Verdict.Wrong);
  });

  it("names the accepted answer that matched", () => {
    expect(checkAnswer("misafr", ["konuk, misafir"])).toEqual({ verdict: Verdict.Almost, expected: "misafir" });
    expect(checkAnswer("CAFE", ["café"]).expected).toBe("café");
  });

  it("prefers an exact answer over a near one", () => {
    expect(checkAnswer("bat", ["bad", "bat"])).toEqual({ verdict: Verdict.Correct, expected: "bat" });
  });
});
