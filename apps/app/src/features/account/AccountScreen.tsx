import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { download } from "@/drivers/download";

import { useAccount } from "@/services/library";
import { SyncProblem } from "@/services/syncService";
import { Button, ButtonKind, Empty, ErrorText, Screen } from "@/ui/components";
import { confirm } from "@/ui/confirm";
import { IS_WEB } from "@/ui/platform";
import { useTheme } from "@/ui/theme";

const PROBLEMS: Record<SyncProblem, string | undefined> = {
  [SyncProblem.None]: undefined,
  [SyncProblem.Offline]: "Sunucuya ulaşılamadı; bağlantı gelince yeniden denenecek.",
  [SyncProblem.ClockAhead]: "Cihaz saatin ileri; saati düzeltince eşitleme sürer.",
  [SyncProblem.Upgrade]: "Eşitleme için uygulamayı güncelle; verilerin cihazda güvende.",
};

const DELETE_WARNING = "Hesabın, sunucudaki tüm kartların ve çalışma geçmişin kalıcı olarak silinecek. Geri alınamaz.";

const time = (ms: number) => new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
const pad = (n: number) => String(n).padStart(2, "0");
/** Local YYYY-MM-DD. */
const dayStamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function AccountScreen() {
  const account = useAccount();
  const theme = useTheme();
  const [deleteFailed, setDeleteFailed] = useState(false);

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
  const remove = async () => {
    if (!(await confirm("Hesabı sil", DELETE_WARNING, "Hesabı sil"))) {
      return;
    }
    setDeleteFailed(!(await account.deleteAccount()));
  };
  const save = async () => download(`dilkart-${dayStamp(new Date())}.json`, await account.exportJson());

  return (
    <Screen>
      <Text style={{ color: theme.text, fontSize: 17, textAlign: "center" }}>{account.email}</Text>
      <Empty text={status.lastSyncAt === undefined ? "Henüz eşitlenmedi" : `Son eşitleme: ${time(status.lastSyncAt)}`} />
      {status.pending > 0 && <Empty text={`${status.pending} değişiklik gönderilmedi`} />}
      {status.failed > 0 && <ErrorText text={`${status.failed} değişiklik sunucuya kabul ettirilemedi.`} />}
      {problem !== undefined && <ErrorText text={problem} />}
      <Button title="Şimdi eşitle" kind={ButtonKind.Primary} onPress={() => void account.syncNow()} />
      <Button title="Çıkış yap" kind={ButtonKind.Danger} onPress={signOut} />
      {IS_WEB ? <Button title="Verilerimi indir" onPress={save} /> : <Empty text="Verilerini dilkart.fly.dev'den indirebilirsin." />}
      <Button title="Hesabı sil" kind={ButtonKind.Danger} onPress={remove} />
      {deleteFailed && <ErrorText text="Hesap silinemedi; bağlantını kontrol edip yeniden dene." />}
    </Screen>
  );
}
