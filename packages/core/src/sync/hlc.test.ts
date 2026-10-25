import { describe, expect, it } from "vitest";

import { decode, encode, receive, tick, zero } from "./hlc";

const NODE_A = "a";
const NODE_B = "b";

describe("hlc", () => {
  it("encodes so that string order equals clock order", () => {
    const clocks = [
      { wall: 9, counter: 0, node: NODE_A },
      { wall: 10, counter: 0, node: NODE_A },
      { wall: 10, counter: 1, node: NODE_A },
      { wall: 10, counter: 1, node: NODE_B },
      { wall: 1_761_379_200_000, counter: 0, node: NODE_A },
    ];
    const encoded = clocks.map(encode);
    expect([...encoded].sort()).toEqual(encoded);
  });

  it("round-trips node ids containing separators", () => {
    const clock = { wall: 1_761_379_200_000, counter: 7, node: "0199c1d2-aaaa-7bbb" };
    expect(decode(encode(clock))).toEqual(clock);
  });

  it("tick follows the wall clock when it moves forward", () => {
    expect(tick(zero(NODE_A), 100)).toEqual({ wall: 100, counter: 0, node: NODE_A });
  });

  it("tick bumps the counter when the wall clock stalls or goes back", () => {
    const first = tick(zero(NODE_A), 100);
    const stalled = tick(first, 100);
    const back = tick(stalled, 50);
    expect(stalled).toEqual({ wall: 100, counter: 1, node: NODE_A });
    expect(back).toEqual({ wall: 100, counter: 2, node: NODE_A });
  });

  it("receive moves past a remote clock from the future", () => {
    const local = tick(zero(NODE_A), 100);
    const remote = { wall: 500, counter: 3, node: NODE_B };
    const next = receive(local, remote, 120);
    expect(next).toEqual({ wall: 500, counter: 4, node: NODE_A });
    expect(encode(next) > encode(remote)).toBe(true);
  });

  it("receive keeps the larger counter on equal walls", () => {
    const local = { wall: 500, counter: 2, node: NODE_A };
    const remote = { wall: 500, counter: 5, node: NODE_B };
    expect(receive(local, remote, 100)).toEqual({ wall: 500, counter: 6, node: NODE_A });
  });

  it("receive follows the wall clock when it is ahead of both", () => {
    const local = { wall: 100, counter: 2, node: NODE_A };
    const remote = { wall: 200, counter: 5, node: NODE_B };
    expect(receive(local, remote, 300)).toEqual({ wall: 300, counter: 0, node: NODE_A });
  });

  it("rejects counter overflow", () => {
    const full = { wall: 100, counter: 9_999, node: NODE_A };
    expect(() => tick(full, 100)).toThrow(RangeError);
  });
});
