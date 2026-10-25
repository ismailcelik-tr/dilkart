import { useAccount } from "@/services/library";
import { Button, ButtonKind, Empty, Screen } from "@/ui/components";
import { goBack } from "@/ui/navigation";

/** Guest cards meeting an account that already has data (plan section 7). */
export function AdoptScreen() {
  const account = useAccount();
  const done = (action: () => Promise<void>) => async () => {
    await action();
    goBack("/");
  };

  return (
    <Screen>
      <Empty text={`Misafirken bu cihaza eklenmiş ${account.guestCards ?? 0} kart var.`} />
      <Empty text="Aynı adlı desteler birleşir; hesabında zaten olan kartlar eklenmez, çalışma geçmişleri korunur." />
      <Button title="Hesabıma ekle" kind={ButtonKind.Primary} onPress={done(account.adopt)} />
      <Button title="Bu cihazda bırak" onPress={done(account.keepGuest)} />
    </Screen>
  );
}
