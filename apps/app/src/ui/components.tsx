import type { ReactElement, ReactNode } from "react";
import { useIsFocused } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { SymbolView, type SFSymbol } from "expo-symbols";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RADIUS, SPACE, useTheme } from "./theme";

/** `typing`: the screen has text fields, so it keeps the focused one above the keyboard. */
export function Screen({ children, typing = false }: { children: ReactNode; typing?: boolean }) {
  const theme = useTheme();
  // Only the screen in front reacts: screens behind a sheet would otherwise shift when it closes.
  const focused = useIsFocused();
  const header = useHeaderHeight();
  const { bottom } = useSafeAreaInsets();
  // Keyboard scrolls clamp at -contentInset.top and ignore the automatic inset, so with the automatic inset
  // the top slid under the header (iOS 26). Typing screens set the inset themselves.
  const insets = typing ? { top: header, bottom } : undefined;
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior={typing ? "never" : "automatic"}
      contentInset={insets}
      scrollIndicatorInsets={insets}
      contentOffset={typing ? { x: 0, y: -header } : undefined}
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
      ListHeaderComponent={props.header && <View style={styles.bar}>{props.header}</View>}
      ListFooterComponent={props.footer && <View style={styles.bar}>{props.footer}</View>}
      onContentSizeChange={props.onContentSizeChange}
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
    />
  );
}

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  const theme = useTheme();
  const group = <View style={[styles.group, { backgroundColor: theme.surface }]}>{children}</View>;
  if (title === undefined) {
    return group;
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.caption, styles.groupTitle, { color: theme.secondary }]}>{title}</Text>
      {group}
    </View>
  );
}

export function Row(props: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
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
        {props.children}
      </View>
      {props.selected && <Text style={[styles.body, { color: theme.tint }]}>✓</Text>}
    </Pressable>
  );
}

/** Read-only row: title left, value right. */
export function InfoRow({ title, value }: { title: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.separator }]}>
      <Text style={[styles.body, styles.rowText, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.secondary }]}>{value}</Text>
    </View>
  );
}

export function SwitchRow(props: { icon: SFSymbol; title: string; value: boolean; onChange: (on: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, styles.switchRow, { borderBottomColor: theme.separator }]}>
      <SymbolView name={props.icon} tintColor={theme.tint} size={22} />
      <Text style={[styles.body, styles.rowText, { color: theme.text }]}>{props.title}</Text>
      <Switch accessibilityLabel={props.title} value={props.value} onValueChange={props.onChange} />
    </View>
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
  bar: { padding: SPACE, gap: SPACE },
  group: { borderRadius: RADIUS, overflow: "hidden" },
  groupTitle: { paddingHorizontal: SPACE },
  row: {
    paddingHorizontal: SPACE,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
  },
  rowText: { flex: 1, gap: 2 },
  switchRow: { gap: 12, borderBottomWidth: 0 },
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
