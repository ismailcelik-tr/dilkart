// Bulk card entry; docs/superpowers/specs/2026-10-28-web-cards-design.md.
import { findDuplicate, validate, type CardDraft, type CardError } from "./card";

const TAB = "\t";
const FIELD = ";";
const MEANING = ",";

export type BulkLine = { line: number; draft: CardDraft } | { line: number; errors: CardError[] };

export interface BulkPlan<T> {
  add: CardDraft[];
  invalid: { line: number; errors: CardError[] }[];
  duplicates: { line: number; front: string; existing?: T; sameAsLine?: number }[];
}

/** One card per non-blank line: front ; meanings (comma separated) ; English example ; Turkish example. */
export function parseBulk(text: string): BulkLine[] {
  const lines: BulkLine[] = [];
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    if (raw.trim() === "") {
      continue;
    }

    const [front = "", meanings = "", exampleEn, exampleTr] = raw.split(raw.includes(TAB) ? TAB : FIELD);
    const checked = validate({ front, meanings: meanings.split(MEANING).map((tr) => ({ tr })), exampleEn, exampleTr });
    lines.push(checked.ok ? { line: i + 1, draft: checked.card } : { line: i + 1, errors: checked.errors });
  }
  return lines;
}

/** Valid lines that are neither cards yet nor repeats of an earlier line. */
export function planBulk<T extends CardDraft>(lines: BulkLine[], existing: T[]): BulkPlan<T> {
  const plan: BulkPlan<T> = { add: [], invalid: [], duplicates: [] };
  const taken: (CardDraft & { line: number })[] = [];
  for (const l of lines) {
    if ("errors" in l) {
      plan.invalid.push(l);
      continue;
    }

    const { draft } = l;
    const card = findDuplicate(draft, existing);
    if (card !== undefined) {
      plan.duplicates.push({ line: l.line, front: draft.front, existing: card });
      continue;
    }
    const twin = findDuplicate(draft, taken);
    if (twin !== undefined) {
      plan.duplicates.push({ line: l.line, front: draft.front, sameAsLine: twin.line });
      continue;
    }

    taken.push({ ...draft, line: l.line });
    plan.add.push(draft);
  }
  return plan;
}
