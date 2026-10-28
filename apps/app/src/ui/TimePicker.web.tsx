// Reminders are mobile only (ADR 0010); the SwiftUI wheel has no web view.
export function TimePicker(_: { value: number; onChange: (minute: number) => void }) {
  return null;
}
