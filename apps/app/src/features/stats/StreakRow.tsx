import { GOAL_OFF, type Today } from "@dilkart/core";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Group, Row } from "@/ui/components";
import { useTheme } from "@/ui/theme";

/** Home row: streak, today's answers and the goal bar; opens the statistics page. */
export function StreakRow({ today }: { today: Today }) {
  const { streak, answers, goal } = today;
  const hasGoal = goal !== GOAL_OFF;
  return (
    <Group>
      <Row
        title={streak > 0 ? `🔥 ${streak} gün seri` : "Seriyi başlat"}
        subtitle={subtitle(today)}
        onPress={() => router.push("/stats")}
      >
        {hasGoal && <Progress ratio={Math.min(answers / goal, 1)} done={answers >= goal} />}
      </Row>
    </Group>
  );
}

function subtitle({ streak, answers, goal }: Today): string {
  const hasGoal = goal !== GOAL_OFF;
  const count = hasGoal ? `${answers}/${goal}` : String(answers);
  if (hasGoal && answers >= goal) {
    return `Hedef tamam: ${count} ✓`;
  }
  if (streak > 0 && answers === 0) {
    const next = `Bugün çalışırsan ${streak + 1} olur`;
    return hasGoal ? `${next} · ${count}` : next;
  }
  return `Bugün ${count} cevap`;
}

function Progress({ ratio, done }: { ratio: number; done: boolean }) {
  const theme = useTheme();
  return (
    <View testID="goal-progress" style={[styles.track, { backgroundColor: theme.separator }]}>
      <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: done ? theme.success : theme.tint }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, borderRadius: 2, marginTop: 6, overflow: "hidden" },
  fill: { height: "100%" },
});
