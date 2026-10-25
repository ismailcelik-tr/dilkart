import { router } from "expo-router";
import { useEffect, useState } from "react";

import { CodeKind, resendCode, verifyCode } from "@/services/account";
import { useAccount } from "@/services/library";
import { Button, ButtonKind, Empty, Field, FieldKind, Screen } from "@/ui/components";

// Matches auth.email.max_frequency in supabase/config.toml.
const RESEND_WAIT_S = 60;
const SECOND_MS = 1_000;

export function VerifyScreen({ email, kind }: { email: string; kind: CodeKind }) {
  const { client } = useAccount();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [wait, setWait] = useState(RESEND_WAIT_S);

  useEffect(() => {
    if (wait === 0) {
      return;
    }
    const timer = setTimeout(() => setWait(wait - 1), SECOND_MS);
    return () => clearTimeout(timer);
  }, [wait]);

  const submit = async () => {
    if (client === undefined) {
      return;
    }
    const result = await verifyCode(client, email, code, kind);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (kind === CodeKind.Recovery) {
      router.replace("/account/new-password");
    } else {
      router.dismissTo("/account");
    }
  };

  const resend = async () => {
    if (client === undefined || wait > 0) {
      return;
    }
    const result = await resendCode(client, email, kind);
    setError(result.ok ? undefined : result.message);
    setWait(RESEND_WAIT_S);
  };

  return (
    <Screen typing>
      <Empty text={`${email} adresine gönderilen 6 haneli kodu gir.`} />
      <Field label="Kod" kind={FieldKind.Code} value={code} onChangeText={setCode} error={error} />
      <Button title="Doğrula" kind={ButtonKind.Primary} onPress={submit} />
      <Button title={wait > 0 ? `Kodu tekrar gönder (${wait} sn)` : "Kodu tekrar gönder"} onPress={resend} />
    </Screen>
  );
}
