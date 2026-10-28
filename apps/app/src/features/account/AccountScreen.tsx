import { router } from "expo-router";
import { Text } from "react-native";

import { useAccount } from "@/services/library";
import { SyncProblem } from "@/services/syncService";
import { Button, ButtonKind, Empty, ErrorText, Screen } from "@/ui/components";
import { confirm } from "@/ui/confirm";
import { useTheme } from "@/ui/theme";

const PROBLEMS: Record<SyncProblem, string | undefined> = {
  [SyncProblem.None]: undefined,
  [SyncProblem.Offline]: "Sunucuya ulaşılamadı; bağlantı gelince yeniden denenecek.",
  [SyncProblem.ClockAhead]: "Cihaz saatin ileri; saati düzeltince eşitleme sürer.",
  [SyncProblem.Upgrade]: "Eşitleme için uygulamayı güncelle; verilerin cihazda güvende.",
};

const time = (ms: number) => new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

export function AccountScreen() {
  const account = useAccount();
  const theme = useTheme();

  if (account.client === undefined) {
    return <Empty text="Bu sürümde hesaplar kapalı; kartların yalnız bu cihazda." />;
  }

  if (account.email === undefined) {
    return (
      <Screen>
        <Empty text="Misafir olarak kullanıyorsun; kartların yalnız bu cihazda." />
        <Button title="Giriş yap" kind={ButtonKind.Primary} onPress={() => router.push("/account/sign-in")} />
        <Button title="Hesap oluştur" onPress={() => router.push("/account/sign-up")} />
      </Screen>
    );
  }

  const { status } = account;
  const problem = PROBLEMS[status.problem];
  const signOut = async () => {
    const message =
      status.pending > 0
        ? `${status.pending} değişiklik henüz gönderilmedi; çıkarsan bu değişiklikler kaybolur.`
        : "Bu cihazdaki hesap verisi silinir; sunucudaki kartların kalır.";
    if (await confirm("Çıkış yap", message, "Çıkış yap")) {
      await account.signOut();
    }
  };

  return (
    <Screen>
      <Text style={{ color: theme.text, fontSize: 17, textAlign: "center" }}>{account.email}</Text>
      <Empty text={status.lastSyncAt === undefined ? "Henüz eşitlenmedi" : `Son eşitleme: ${time(status.lastSyncAt)}`} />
      {status.pending > 0 && <Empty text={`${status.pending} değişiklik gönderilmedi`} />}
      {status.failed > 0 && <ErrorText text={`${status.failed} değişiklik sunucuya kabul ettirilemedi.`} />}
      {problem !== undefined && <ErrorText text={problem} />}
      <Button title="Şimdi eşitle" kind={ButtonKind.Primary} onPress={() => void account.syncNow()} />
      <Button title="Çıkış yap" kind={ButtonKind.Danger} onPress={signOut} />
    </Screen>
  );
}
