import { desc, eq } from "drizzle-orm";
import { records, type Record } from "@db/schema";
import { getDb } from "./connection";

export type RecordCategory =
  | "TOP_RATING"
  | "MOST_GOALS_MATCH"
  | "BIGGEST_WIN"
  | "LONGEST_UNBEATEN";

export const RECORD_CATEGORIES: RecordCategory[] = [
  "TOP_RATING",
  "MOST_GOALS_MATCH",
  "BIGGEST_WIN",
  "LONGEST_UNBEATEN",
];

/** Current holder of a category = latest row of that category. */
export async function currentRecord(
  category: RecordCategory,
): Promise<Record | undefined> {
  return getDb().query.records.findFirst({
    where: eq(records.category, category),
    orderBy: [desc(records.id)],
  });
}

/**
 * Insert a new records row when `value` beats the current holder (or when no
 * holder exists yet and `value >= minValue`). Returns the new row, or null.
 */
export async function breakRecord(
  category: RecordCategory,
  holder: { userId: number; clubName: string },
  value: number,
  detail: string,
  minValue = 1,
): Promise<Record | null> {
  const current = await currentRecord(category);
  if (value < minValue) return null;
  if (current && value <= current.value) return null;

  const db = getDb();
  const [{ id }] = await db
    .insert(records)
    .values({
      category,
      holderUserId: holder.userId,
      holderClubName: holder.clubName.slice(0, 60),
      value,
      detail: detail.slice(0, 120),
    })
    .$returningId();
  return (await db.query.records.findFirst({ where: eq(records.id, id) }))!;
}

/** Current holder per category (latest row per category). */
export async function currentRecords(): Promise<Record[]> {
  const out: Record[] = [];
  for (const category of RECORD_CATEGORIES) {
    const row = await currentRecord(category);
    if (row) out.push(row);
  }
  return out;
}

/** Latest N record rows across all categories (ticker). */
export async function recentRecords(limit = 20): Promise<Record[]> {
  return getDb()
    .select()
    .from(records)
    .orderBy(desc(records.id))
    .limit(limit);
}
