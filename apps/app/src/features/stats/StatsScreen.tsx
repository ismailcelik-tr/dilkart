import { GOAL_OFF, weekday, type Report, type Retention } from "@dilkart/core";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useLoad, useStats } from "@/services/library";
import { Empty, Group, InfoRow, Screen } from "@/ui/components";
import { SPACE, useTheme } from "@/ui/theme";

import { Bars } from "./Bars";

const WEEKDAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

export function StatsScreen() {
  const stats = useStats();
  const [report] = useLoad(useCallback(() => stats.report(), [stats]));
  if (report === undefined) {
    return null;
  }

  const { states } = report;
  return (
    <Screen>
      {report.streak.longest > 0 ? <History report={report} /> : <Empty text="Henüz çalışma yok" />}
      <Group title="Kartlar">
        <InfoRow title="Yeni" value={String(states.new)} />
        <InfoRow title="Öğreniliyor" value={String(states.learning)} />
        <InfoRow title="Tekrarda" value={String(states.review)} />
        <InfoRow title="Olgun" value={String(states.mature)} />
      </Group>
      <Group title="Önümüzdeki 7 gün">
        <View style={styles.chart}>
          <Bars values={report.forecast} labels={report.forecast.map((_, i) => dayLabel(report.today, i))} />
        </View>
      </Group>
    </Screen>
  );
}

function History({ report }: { report: Report }) {
  const theme = useTheme();
  const total = report.daily.reduce((a, b) => a + b, 0);
  const average = Math.round(total / report.daily.length);
  const most = Math.max(...report.daily);
  const caption = [styles.caption, { color: theme.secondary }];

  return (
    <>
      <Group title="Seri">
        <InfoRow title="Şu an" value={`${report.streak.current} gün`} />
        <InfoRow title="En uzun" value={`${report.streak.longest} gün`} />
      </Group>
      <Group title="Son 30 gün">
        <View style={styles.chart}>
          <Bars values={report.daily} goal={report.goal === GOAL_OFF ? undefined : report.goal} />
          <Text style={caption}>{`Toplam ${total} · günlük ort. ${average} · en yüksek ${most}`}</Text>
        </View>
      </Group>
      <Group title="Hatırlama">
        <InfoRow title="7 gün" value={rate(report.retention7)} />
        <InfoRow title="30 gün" value={rate(report.retention30)} />
      </Group>
      <Text style={[caption, styles.note]}>{`Tekrar aşamasındaki kartlarda "Tekrar" dışındaki cevaplar.`}</Text>
    </>
  );
}

const rate = (r: Retention | null) => (r === null ? "—" : `%${Math.round(r.rate * 100)} · ${r.total} cevap`);

function dayLabel(today: number, offset: number): string {
  if (offset === 0) {
    return "Bugün";
  }
  if (offset === 1) {
    return "Yarın";
  }
  return WEEKDAYS[weekday(today + offset)] ?? "";
}

const styles = StyleSheet.create({
  chart: { padding: SPACE, gap: 8 },
  caption: { fontSize: 13 },
  note: { paddingHorizontal: SPACE },
});
