import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/ui/theme";

const HEIGHT = 80;

/** Bottom-aligned bars. `labels` adds each value above and its label below; `goal` is for unlabeled bars. */
export function Bars({ values, labels, goal }: { values: number[]; labels?: string[]; goal?: number }) {
  const theme = useTheme();
  const top = Math.max(...values, goal ?? 0, 1);
  const height = (v: number) => (v / top) * HEIGHT;
  const caption = [styles.caption, { color: theme.secondary }];

  return (
    <View style={styles.plot}>
      {values.map((v, i) => (
        <View key={i} style={styles.column}>
          {labels !== undefined && <Text style={caption}>{v}</Text>}
          <View style={[styles.bar, { height: height(v), backgroundColor: theme.tint }]} />
          {labels !== undefined && <Text style={caption}>{labels[i]}</Text>}
        </View>
      ))}
      {goal !== undefined && (
        <View testID="goal-line" style={[styles.goal, { bottom: height(goal), backgroundColor: theme.secondary }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: "row", alignItems: "flex-end", gap: 2, minHeight: HEIGHT },
  column: { flex: 1, alignItems: "center", gap: 4 },
  bar: { alignSelf: "stretch", borderRadius: 2 },
  goal: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth * 2 },
  caption: { fontSize: 13 },
});
