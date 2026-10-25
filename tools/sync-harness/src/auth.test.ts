// Plan section 12, e-mail verification and reset: codes, not links (ADR 0005). Needs `supabase start`.
import { uuidv7 } from "@dilkart/core";
import { describe, expect, it } from "vitest";

import { anonClient, latestCode } from "./local";

const PASSWORD = "Harness-pass-1";
const NEW_PASSWORD = "Harness-pass-2";
const CODE = /^\d{6}$/;

const email = () => `${uuidv7()}@harness.local`;

describe("sign-up", () => {
  it("activates the account with the six-digit code from the e-mail", async () => {
    const client = anonClient();
    const address = email();
    const signUp = await client.auth.signUp({ email: address, password: PASSWORD });
    expect(signUp.error).toBeNull();
    expect(signUp.data.session).toBeNull();

    const code = await latestCode(address);
    expect(code).toMatch(CODE);
    const verified = await client.auth.verifyOtp({ email: address, token: code, type: "signup" });
    expect(verified.error).toBeNull();
    expect(verified.data.session?.user.email).toBe(address);
  });

  it("rejects a wrong code", async () => {
    const client = anonClient();
    const address = email();
    await client.auth.signUp({ email: address, password: PASSWORD });
    const code = await latestCode(address);
    const wrong = code === "000000" ? "111111" : "000000";

    const { error } = await client.auth.verifyOtp({ email: address, token: wrong, type: "signup" });
    expect(error).not.toBeNull();
  });

  it("refuses to resend the code within 60 seconds", async () => {
    const client = anonClient();
    const address = email();
    await client.auth.signUp({ email: address, password: PASSWORD });
    await latestCode(address);

    const { error } = await client.auth.resend({ email: address, type: "signup" });
    expect(error?.status).toBe(429);
  });

  it("signs in only after verification", async () => {
    const client = anonClient();
    const address = email();
    await client.auth.signUp({ email: address, password: PASSWORD });
    const early = await client.auth.signInWithPassword({ email: address, password: PASSWORD });
    expect(early.error?.code).toBe("email_not_confirmed");
  });
});

describe("password reset", () => {
  it("sets a new password with the code from the e-mail", async () => {
    const client = anonClient();
    const address = email();
    await client.auth.signUp({ email: address, password: PASSWORD });
    await client.auth.verifyOtp({ email: address, token: await latestCode(address), type: "signup" });
    await client.auth.signOut();

    // The reset mail must not be throttled by the sign-up mail.
    await new Promise((r) => setTimeout(r, 61_000));
    expect((await client.auth.resetPasswordForEmail(address)).error).toBeNull();
    const reset = await client.auth.verifyOtp({ email: address, token: await latestCode(address, 2), type: "recovery" });
    expect(reset.error).toBeNull();
    expect((await client.auth.updateUser({ password: NEW_PASSWORD })).error).toBeNull();
    await client.auth.signOut();

    const signIn = await anonClient().auth.signInWithPassword({ email: address, password: NEW_PASSWORD });
    expect(signIn.error).toBeNull();
  }, 90_000);
});
