import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertUser } from "@db/schema";
import { getDb } from "./connection";
import { env } from "../lib/env";

export async function findUserByUnionId(unionId: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.unionId, unionId))
    .limit(1);
  return rows.at(0);
}

/**
 * Creates (or refreshes) a name-only guest account. Guests live in the same
 * table as provider users so every downstream query works unchanged; the
 * "guest:" unionId prefix keeps the two namespaces from ever colliding.
 */
export async function upsertGuestUser(data: { unionId: string; name: string }) {
  await getDb()
    .insert(schema.users)
    .values({
      unionId: data.unionId,
      name: data.name,
      lastSignInAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: { name: data.name, lastSignInAt: new Date() },
    });
}

export async function upsertUser(data: InsertUser) {
  const values = { ...data };
  const updateSet: Partial<InsertUser> = {
    lastSignInAt: new Date(),
    ...data,
  };

  if (
    values.role === undefined &&
    values.unionId &&
    values.unionId === env.ownerUnionId
  ) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await getDb()
    .insert(schema.users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}
