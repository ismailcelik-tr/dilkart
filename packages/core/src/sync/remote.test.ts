import { describe, expect, it, vi } from "vitest";

import { PermanentError, UpgradeRequired } from "./engine";
import { rpcRemote, type RpcClient } from "./remote";

const client = (result: Awaited<ReturnType<RpcClient["rpc"]>>): RpcClient => ({ rpc: async () => result });
const failure = (code: string, status: number) => client({ data: null, error: { code, message: "boom" }, status });

describe("rpcRemote", () => {
  it("passes ops and rows through", async () => {
    const rpc = vi.fn(async () => ({ data: [{ seq: 1, tbl: "decks", data: {} }], error: null, status: 200 }));
    const remote = rpcRemote({ rpc });
    await remote.push([], 1);
    expect(await remote.pull(0, 10)).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("sync_push", { ops: [], schema_version: 1 });
    expect(rpc).toHaveBeenCalledWith("sync_pull", { since: 0, page: 10 });
  });

  it("maps an outdated schema to UpgradeRequired", async () => {
    await expect(rpcRemote(failure("DK001", 400)).push([], 0)).rejects.toBeInstanceOf(UpgradeRequired);
  });

  it("treats bad data as permanent and outages as retryable", async () => {
    await expect(rpcRemote(failure("22P02", 400)).push([], 1)).rejects.toBeInstanceOf(PermanentError);
    for (const status of [0, 401, 408, 429, 500, 503]) {
      const error = await rpcRemote(failure("x", status)).push([], 1).catch((e: unknown) => e);
      expect(error).not.toBeInstanceOf(PermanentError);
    }
  });

  // Browsers hide the Date header of cross-origin responses, so the clock comes from an RPC.
  it("reads the server clock from server_time", async () => {
    const at = Date.parse("2026-10-25T12:00:00Z");
    const rpc = vi.fn(async () => ({ data: at, error: null, status: 200 }));
    expect(await rpcRemote({ rpc }).serverTime()).toBe(at);
    expect(rpc).toHaveBeenCalledWith("server_time", {});
  });
});
