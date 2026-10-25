import type { ReactElement, ReactNode } from "react";
import { useIsFocused } from "expo-router";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { RADIUS, SPACE, useTheme } from "./theme";

/** `typing`: the screen has text fields, so it keeps the focused one above the keyboard. */
export function Screen({ children, typing = false }: { children: ReactNode; typing?: boolean }) {
  const theme = useTheme();
  // Only the screen in front reacts: screens behind a sheet would otherwise shift when it closes.
  const focused = useIsFocused();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      // iOS; Android resizes the window instead.
      automaticallyAdjustKeyboardInsets={typing && focused}
      keyboardDismissMode={typing ? "interactive" : "none"}
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

export function Row(props: { title: string; subtitle?: string; selected?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.separator }, pressed && styles.pressed]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.body, { color: theme.text }]}>{props.title}</Text>
        {props.subtitle !== undefined && (
          <Text style={[styles.caption, { color: theme.secondary }]}>{props.subtitle}</Text>
        )}
      </View>
      {props.selected && <Text style={[styles.body, { color: theme.tint }]}>✓</Text>}
    </Pressable>
  );
}

/** Swipe left to reveal a delete action; deleting is left to `onDelete`, which should confirm. */
export function SwipeToDelete({ label, onDelete, children }: { label: string; onDelete: () => void; children: ReactNode }) {
  const theme = useTheme();
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      // The action sits behind the row; a transparent row would show it before any swipe.
      childrenContainerStyle={{ backgroundColor: theme.surface }}
      renderRightActions={(_progress, _translation, swipeable) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => {
            swipeable.close();
            onDelete();
          }}
          style={[styles.swipeAction, { backgroundColor: theme.danger }]}
        >
          <Text style={styles.swipeText}>Sil</Text>
        </Pressable>
      )}
    >
      {children}
    </ReanimatedSwipeable>
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

export enum FieldKind {
  Text = "text",
  Email = "email",
  Password = "password",
  Code = "code",
}

export function Field(props: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  kind?: FieldKind;
  hint?: string;
}) {
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
        secureTextEntry={props.kind === FieldKind.Password}
        keyboardType={props.kind === FieldKind.Email ? "email-address" : props.kind === FieldKind.Code ? "number-pad" : "default"}
        textContentType={props.kind === FieldKind.Code ? "oneTimeCode" : undefined}
        style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
      />
      {props.hint !== undefined && <Text style={[styles.caption, { color: theme.secondary }]}>{props.hint}</Text>}
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
  row: {
    paddingHorizontal: SPACE,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
  },
  rowText: { flex: 1, gap: 2 },
  body: { fontSize: 17 },
  caption: { fontSize: 13 },
  pressed: { opacity: 0.6 },
  button: { paddingVertical: 12, paddingHorizontal: SPACE, borderRadius: RADIUS, alignItems: "center" },
  buttonText: { fontSize: 17, fontWeight: "600" },
  field: { gap: 6 },
  input: { fontSize: 17, paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS },
  empty: { fontSize: 17, textAlign: "center", paddingVertical: 32 },
  swipeAction: { width: 88, justifyContent: "center", alignItems: "center" },
  swipeText: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },
});
