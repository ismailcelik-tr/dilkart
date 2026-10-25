import { router } from "expo-router";
import { useState } from "react";

import { signIn } from "@/services/account";
import { useAccount } from "@/services/library";
import { Button, ButtonKind, Field, FieldKind, Screen } from "@/ui/components";
import { goBack } from "@/ui/navigation";

export function SignInScreen() {
  const { client } = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (client === undefined) {
      return;
    }
    const result = await signIn(client, email, password);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    goBack("/account");
  };

  return (
    <Screen>
      <Field label="E-posta" kind={FieldKind.Email} value={email} onChangeText={setEmail} />
      <Field label="Şifre" kind={FieldKind.Password} value={password} onChangeText={setPassword} error={error} />
      <Button title="Giriş yap" kind={ButtonKind.Primary} onPress={submit} />
      <Button title="Şifremi unuttum" onPress={() => router.push("/account/forgot")} />
    </Screen>
  );
}
