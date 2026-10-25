// One SQLite file per person on the device (plan section 7).
export const GUEST_DB = "guest.sqlite";
export const userDb = (uid: string) => `user_${uid}.sqlite`;
