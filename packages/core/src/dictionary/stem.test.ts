import { describe, expect, it } from "vitest";

import { turkishStems } from "./stem";

const level = (groups: string[][], candidate: string) => groups.findIndex((g) => g.includes(candidate));

describe("turkishStems", () => {
  it.each([
    ["kitaplar", "kitapla", "kitap"],
    ["evler", "evle", "ev"],
  ])("%s: longer stems first", (word, longer, shorter) => {
    const groups = [...turkishStems(word)];
    expect(level(groups, longer)).toBeLessThanOrEqual(level(groups, shorter));
  });

  it.each([
    ["kitabı", ["kitab", "kitap"]],
    ["gidecek", ["gid", "git", "gitmek"]],
    ["ağacı", ["ağac", "ağaç"]],
    ["kurulması", ["kurul", "kurulmak"]],
    ["ettiğim", ["et", "etmek"]],
  ])("%s: softened stem and infinitive share a group", (word, sameGroup) => {
    const groups = [...turkishStems(word)];
    expect(new Set(sameGroup.map((c) => level(groups, c))).size).toBe(1);
  });

  it.each([
    ["tutuyor", "tutmak"],
    ["okuyor", "okumak"],
    ["gidiyorum", "gitmek"],
    ["söylüyor", "söylemek"],
    ["yedim", "yemek"],
    ["gördük", "görmek"],
    ["baktılar", "bakmak"],
    ["gidiyordum", "gitmek"],
  ])("%s: verb forms try %s first", (word, infinitive) => {
    expect(turkishStems(word).next().value).toContain(infinitive);
  });

  it("skips phrases and short words", () => {
    expect([...turkishStems("kitap kurdu")]).toEqual([]);
    expect([...turkishStems("ev")]).toEqual([]);
  });
});
