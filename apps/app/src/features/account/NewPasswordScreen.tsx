import { router } from "expo-router";
import { useState } from "react";

import { setPassword } from "@/services/account";
import { useAccount } from "@/services/library";
import { Button, ButtonKind, Field, FieldKind, Screen } from "@/ui/components";

export function NewPasswordScreen() {
  const { client } = useAccount();
  const [password, setValue] = useState("");
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (client === undefined) {
      return;
    }
    const result = await setPassword(client, password);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.dismissTo("/account");
  };

  return (
    <Screen typing>
      <Field
        label="Yeni şifre"
        kind={FieldKind.Password}
        value={password}
        onChangeText={setValue}
        hint="En az 8 karakter."
        error={error}
      />
      <Button title="Şifreyi kaydet" kind={ButtonKind.Primary} onPress={submit} />
    </Screen>
  );
}
