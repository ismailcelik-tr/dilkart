import { router } from "expo-router";
import { useState } from "react";

import { CodeKind, signUp } from "@/services/account";
import { useAccount } from "@/services/library";
import { Button, ButtonKind, Field, FieldKind, Screen } from "@/ui/components";

export function SignUpScreen() {
  const { client } = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (client === undefined) {
      return;
    }
    const result = await signUp(client, email, password);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push({ pathname: "/account/verify", params: { email: email.trim(), kind: CodeKind.SignUp } });
  };

  return (
    <Screen>
      <Field label="E-posta" kind={FieldKind.Email} value={email} onChangeText={setEmail} />
      <Field
        label="Şifre"
        kind={FieldKind.Password}
        value={password}
        onChangeText={setPassword}
        hint="En az 8 karakter; harf ve rakam içersin."
        error={error}
      />
      <Button title="Kayıt ol" kind={ButtonKind.Primary} onPress={submit} />
    </Screen>
  );
}
