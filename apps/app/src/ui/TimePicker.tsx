import { DatePicker, Host } from "@expo/ui/swift-ui";
import { datePickerStyle } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";

const MINUTES_PER_HOUR = 60;

/** iOS hour and minute wheel; `value` is minutes after local midnight. */
export function TimePicker({ value, onChange }: { value: number; onChange: (minute: number) => void }) {
  const selection = new Date();
  selection.setHours(Math.floor(value / MINUTES_PER_HOUR), value % MINUTES_PER_HOUR, 0, 0);
  return (
    <Host matchContents style={styles.center}>
      <DatePicker
        selection={selection}
        displayedComponents={["hourAndMinute"]}
        modifiers={[datePickerStyle("wheel")]}
        onDateChange={(d) => onChange(d.getHours() * MINUTES_PER_HOUR + d.getMinutes())}
      />
    </Host>
  );
}

// matchContents shrinks the host to the wheel, which otherwise sits at the start.
const styles = StyleSheet.create({ center: { alignSelf: "center" } });
