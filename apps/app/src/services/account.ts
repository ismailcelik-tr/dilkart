// Auth actions for the screens; Supabase errors become Turkish messages (ADR 0005: codes, not links).
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";

export enum CodeKind {
  SignUp = "signup",
  Recovery = "recovery",
}

export type AuthResult = { ok: true } | { ok: false; message: string };

const MESSAGES: Record<string, string> = {
  otp_expired: "Kod hatalı ya da süresi dolmuş.",
  invalid_credentials: "E-posta ya da şifre hatalı.",
  email_not_confirmed: "E-posta adresin henüz doğrulanmadı.",
  user_already_exists: "Bu e-postayla bir hesap zaten var.",
  email_exists: "Bu e-postayla bir hesap zaten var.",
  weak_password: "Şifre en az 8 karakter olmalı.",
  over_email_send_rate_limit: "Yeni kod için biraz bekle.",
  validation_failed: "E-posta adresini kontrol et.",
  email_address_invalid: "E-posta adresini kontrol et.",
};
const FALLBACK = "Bir sorun oldu; bağlantını kontrol edip tekrar dene.";

function result(error: AuthError | null): AuthResult {
  if (error === null) {
    return { ok: true };
  }
  if (__DEV__) {
    console.warn("AUTH", error.name, error.code, error.status, error.message);
  }
  return { ok: false, message: MESSAGES[error.code ?? ""] ?? FALLBACK };
}

/** Needs the e-mailed code before the account works. */
export const signUp = async (client: SupabaseClient, email: string, password: string) =>
  result((await client.auth.signUp({ email: email.trim(), password })).error);

export const verifyCode = async (client: SupabaseClient, email: string, code: string, kind: CodeKind) =>
  result((await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: kind })).error);

export const resendCode = async (client: SupabaseClient, email: string, kind: CodeKind) =>
  kind === CodeKind.SignUp
    ? result((await client.auth.resend({ email: email.trim(), type: "signup" })).error)
    : result((await client.auth.resetPasswordForEmail(email.trim())).error);

export const signIn = async (client: SupabaseClient, email: string, password: string) =>
  result((await client.auth.signInWithPassword({ email: email.trim(), password })).error);

/** Mails a recovery code; verifying it signs the user in to set a new password. */
export const forgotPassword = async (client: SupabaseClient, email: string) =>
  result((await client.auth.resetPasswordForEmail(email.trim())).error);

export const setPassword = async (client: SupabaseClient, password: string) =>
  result((await client.auth.updateUser({ password })).error);
