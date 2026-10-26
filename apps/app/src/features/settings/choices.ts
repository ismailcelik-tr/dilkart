import { Accent, UNLIMITED, type UserSettings } from "@dilkart/core";

export type Field = keyof UserSettings;

interface Choice {
  value: UserSettings[Field];
  label: string;
}

const numbers = (values: number[]): Choice[] => values.map((v) => ({ value: v, label: String(v) }));
const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;

export const FIELDS: Record<Field, { title: string; choices: Choice[] }> = {
  newPerDay: { title: "Günlük yeni kart", choices: numbers([5, 10, 20, 30, 50]) },
  reviewsPerDay: {
    title: "Günlük tekrar",
    choices: [...numbers([50, 100, 200, 500]), { value: UNLIMITED, label: "Sınırsız" }],
  },
  dayStartHour: { title: "Gün başlangıcı", choices: [0, 1, 2, 3, 4, 5, 6].map((h) => ({ value: h, label: hour(h) })) },
  accent: {
    title: "Aksan",
    choices: [
      { value: Accent.US, label: "ABD" },
      { value: Accent.GB, label: "İngiliz" },
    ],
  },
};

/** A value synced from elsewhere may be off the list; it shows as is. */
export const labelOf = (field: Field, value: UserSettings[Field]) =>
  FIELDS[field].choices.find((c) => c.value === value)?.label ?? String(value);

export const isField = (s: string | undefined): s is Field => s !== undefined && s in FIELDS;
