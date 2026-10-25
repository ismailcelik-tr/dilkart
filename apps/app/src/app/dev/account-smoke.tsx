import { useEffect, useRef, useState } from "react";

import { signIn } from "@/services/account";
import { useAccount, useLibrary } from "@/services/library";
import { SyncProblem } from "@/services/syncService";
import { Empty } from "@/ui/components";

// Local Supabase only; create the user with the admin API first (see docs/plan.md stage 7).
const EMAIL = "smoke@dilkart.local";
const PASSWORD = "Smoke-pass1";

/** Signs in, creates a deck, waits for one sync round and signs out. Result: `ACCOUNT_SMOKE` log line. */
export default function AccountSmoke() {
  const account = useAccount();
  const lib = useLibrary();
  const [step, setStep] = useState("Giriş yapılıyor");
  const started = useRef(false);
  const wrote = useRef(false);

  useEffect(() => {
    if (started.current || account.client === undefined) {
      return;
    }
    started.current = true;
    signIn(account.client, EMAIL, PASSWORD).then((r) => setStep(r.ok ? "Eşitleniyor" : `Giriş olmadı: ${r.message}`));
  }, [account.client]);

  useEffect(() => {
    if (account.email !== EMAIL || wrote.current) {
      return;
    }
    wrote.current = true;
    void lib.createDeck(`Duman ${new Date().toISOString()}`).then(() => account.syncNow());
  }, [account, lib]);

  const { status } = account;
  const reported = useRef(false);
  useEffect(() => {
    const sent = wrote.current && status.lastSyncAt !== undefined && status.pending === 0;
    if (reported.current || !(sent || status.problem !== SyncProblem.None)) {
      return;
    }
    reported.current = true;
    console.log("ACCOUNT_SMOKE", JSON.stringify({ email: account.email, ...status }));
    setStep("Bitti");
    void account.signOut();
  }, [status, account]);

  return <Empty text={step} />;
}
