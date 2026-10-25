import type { ReactElement, ReactNode } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { RADIUS, SPACE, useTheme } from "./theme";

export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  );
}

/** Virtualized screen: only visible rows render, so long decks open fast. */
export function ListScreen<T>(props: {
  data: T[];
  keyOf: (item: T) => string;
  render: (item: T) => ReactElement;
  header?: ReactElement;
  footer?: ReactElement;
  onContentSizeChange?: () => void;
}) {
  const theme = useTheme();
  return (
    <FlatList
      data={props.data}
      keyExtractor={props.keyOf}
      renderItem={({ item }) => <View style={{ backgroundColor: theme.surface }}>{props.render(item)}</View>}
      ListHeaderComponent={props.header}
      ListFooterComponent={props.footer && <View style={styles.footer}>{props.footer}</View>}
      onContentSizeChange={props.onContentSizeChange}
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
    />
  );
}

export function Group({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.group, { backgroundColor: theme.surface }]}>{children}</View>;
}

export function Row({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.separator }, pressed && styles.pressed]}
    >
      <Text style={[styles.body, { color: theme.text }]}>{title}</Text>
      {subtitle !== undefined && <Text style={[styles.caption, { color: theme.secondary }]}>{subtitle}</Text>}
    </Pressable>
  );
}

export enum ButtonKind {
  Primary = "primary",
  Plain = "plain",
  Danger = "danger",
}

export function Button({ title, onPress, kind = ButtonKind.Plain }: { title: string; onPress: () => void; kind?: ButtonKind }) {
  const theme = useTheme();
  const primary = kind === ButtonKind.Primary;
  const color = primary ? "#FFFFFF" : kind === ButtonKind.Danger ? theme.danger : theme.tint;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, primary && { backgroundColor: theme.tint }, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function Field(props: { label: string; value: string; onChangeText: (text: string) => void; error?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.caption, { color: theme.secondary }]}>{props.label}</Text>
      <TextInput
        accessibilityLabel={props.label}
        value={props.value}
        onChangeText={props.onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
      />
      {props.error !== undefined && <ErrorText text={props.error} />}
    </View>
  );
}

export function ErrorText({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[styles.caption, { color: theme.danger }]}>{text}</Text>;
}

export function Empty({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[styles.empty, { color: theme.secondary }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  screen: { padding: SPACE, gap: SPACE },
  list: { paddingVertical: SPACE },
  footer: { padding: SPACE, gap: SPACE },
  group: { borderRadius: RADIUS, overflow: "hidden" },
  row: { paddingHorizontal: SPACE, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  body: { fontSize: 17 },
  caption: { fontSize: 13 },
  pressed: { opacity: 0.6 },
  button: { paddingVertical: 12, paddingHorizontal: SPACE, borderRadius: RADIUS, alignItems: "center" },
  buttonText: { fontSize: 17, fontWeight: "600" },
  field: { gap: 6 },
  input: { fontSize: 17, paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS },
  empty: { fontSize: 17, textAlign: "center", paddingVertical: 32 },
});
