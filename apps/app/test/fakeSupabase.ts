import { uuidv7, type Op, type RemoteRow } from "@dilkart/core";

type Listener = (event: string, session: unknown) => void;
const error = (code: string) => ({ code, message: code, status: 400 });

/** Just enough of SupabaseClient for the account screens and sync. */
export class FakeSupabase {
  users = new Map<string, { id: string; password: string; confirmed: boolean }>();
  codes = new Map<string, string>();
  session: { user: { id: string; email: string } } | null = null;
  rows: RemoteRow[] = [];
  pushed: Op[] = [];
  outage = false;
  /** While set, RPCs wait for it, so a test can act during a sync round. */
  gate?: Promise<void>;
  private listeners = new Set<Listener>();

  user(email: string, password = "pass1234", confirmed = true) {
    const id = uuidv7();
    this.users.set(email, { id, password, confirmed });
    return id;
  }

  private setSession(email: string | null) {
    const u = email === null ? undefined : this.users.get(email);
    this.session = email !== null && u ? { user: { id: u.id, email } } : null;
    this.listeners.forEach((l) => l(this.session ? "SIGNED_IN" : "SIGNED_OUT", this.session));
  }

  auth = {
    getSession: async () => ({ data: { session: this.session }, error: null }),
    onAuthStateChange: (listener: Listener) => {
      this.listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => this.listeners.delete(listener) } } };
    },
    signUp: async ({ email, password }: { email: string; password: string }) => {
      if (this.users.has(email)) {
        return { data: {}, error: error("user_already_exists") };
      }
      this.user(email, password, false);
      this.codes.set(email, "123456");
      return { data: { session: null }, error: null };
    },
    verifyOtp: async ({ email, token }: { email: string; token: string }) => {
      const u = this.users.get(email);
      if (!u || this.codes.get(email) !== token) {
        return { data: {}, error: error("otp_expired") };
      }
      u.confirmed = true;
      this.setSession(email);
      return { data: { session: this.session }, error: null };
    },
    resend: async () => ({ data: {}, error: null }),
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const u = this.users.get(email);
      if (!u || u.password !== password) {
        return { data: {}, error: error("invalid_credentials") };
      }
      if (!u.confirmed) {
        return { data: {}, error: error("email_not_confirmed") };
      }
      this.setSession(email);
      return { data: { session: this.session }, error: null };
    },
    resetPasswordForEmail: async (email: string) => {
      this.codes.set(email, "654321");
      return { data: {}, error: null };
    },
    updateUser: async ({ password }: { password: string }) => {
      const u = this.session && this.users.get(this.session.user.email);
      if (u) {
        u.password = password;
      }
      return { data: {}, error: null };
    },
    signOut: async () => {
      this.setSession(null);
      return { error: null };
    },
  };

  rpc = async (fn: string, args: Record<string, unknown>) => {
    await this.gate;
    if (this.outage) {
      return { data: null, error: { message: "offline" }, status: 0 };
    }
    if (fn === "server_time") {
      return { data: Date.now(), error: null, status: 200 };
    }
    if (fn === "sync_push") {
      this.pushed.push(...(args.ops as Op[]));
      return { data: (args.ops as Op[]).length, error: null, status: 200 };
    }
    const since = Number(args.since);
    return { data: this.rows.filter((r) => r.seq > since).slice(0, Number(args.page)), error: null, status: 200 };
  };
}
