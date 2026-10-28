// Reminders are mobile only (ADR 0010); expo-notifications has no local scheduling on web.
export enum Permission {
  Granted = "granted",
  Denied = "denied",
  Undetermined = "undetermined",
}

export const permission = async () => Permission.Denied;
export const requestPermission = async () => Permission.Denied;
export const schedule = async (_id: string, _at: Date, _title: string, _body: string) => undefined;
export const cancel = async (_ids: string[]) => undefined;
