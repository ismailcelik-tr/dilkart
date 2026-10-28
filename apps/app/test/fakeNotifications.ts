// In-memory drivers/notifications; tests read and set `fake`.
export enum Permission {
  Granted = "granted",
  Denied = "denied",
  Undetermined = "undetermined",
}

interface Scheduled {
  at: Date;
  title: string;
  body: string;
}

export const fake = { permission: Permission.Undetermined, asked: 0, scheduled: new Map<string, Scheduled>() };

export function resetFake() {
  fake.permission = Permission.Undetermined;
  fake.asked = 0;
  fake.scheduled.clear();
}

export const permission = async () => fake.permission;

export async function requestPermission() {
  fake.asked++;
  fake.permission = Permission.Granted;
  return fake.permission;
}

export async function schedule(id: string, at: Date, title: string, body: string) {
  fake.scheduled.set(id, { at, title, body });
}

export async function cancel(ids: string[]) {
  for (const id of ids) {
    fake.scheduled.delete(id);
  }
}
