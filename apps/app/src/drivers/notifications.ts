// Local notifications only; no push.
import * as Notifications from "expo-notifications";

export enum Permission {
  Granted = "granted",
  Denied = "denied",
  Undetermined = "undetermined",
}

const toPermission = (status: string) => Object.values(Permission).find((p) => p === status) ?? Permission.Undetermined;

export async function permission(): Promise<Permission> {
  return toPermission((await Notifications.getPermissionsAsync()).status);
}

export async function requestPermission(): Promise<Permission> {
  return toPermission((await Notifications.requestPermissionsAsync()).status);
}

/** Replaces any notification with the same id. */
export async function schedule(id: string, at: Date, title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

export async function cancel(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}
