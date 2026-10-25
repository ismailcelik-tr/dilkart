import { router } from "expo-router";
import { useState } from "react";

import { CodeKind, forgotPassword } from "@/services/account";
import { useAccount } from "@/services/library";
import { Button, ButtonKind, Field, FieldKind, Screen } from "@/ui/components";

export function ForgotScreen() {
  const { client } = useAccount();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (client === undefined) {
      return;
    }
    const result = await forgotPassword(client, email);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push({ pathname: "/account/verify", params: { email: email.trim(), kind: CodeKind.Recovery } });
  };

  return (
    <Screen typing>
      <Field label="E-posta" kind={FieldKind.Email} value={email} onChangeText={setEmail} error={error} />
      <Button title="Kod gönder" kind={ButtonKind.Primary} onPress={submit} />
    </Screen>
  );
}
