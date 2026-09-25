import { desc, eq } from "drizzle-orm";
import { chatMessages, type ChatMessage, type User } from "@db/schema";
import { getDb } from "./connection";
import { findClubByUserId } from "./clubs";

/** Latest N chat messages, oldest first. */
export async function listChatMessages(limit = 50): Promise<ChatMessage[]> {
  const rows = await getDb()
    .select()
    .from(chatMessages)
    .orderBy(desc(chatMessages.id))
    .limit(limit);
  return rows.reverse();
}

/**
 * Post a lobby chat message. The display name is a snapshot of the club name
 * when the user has a club, otherwise the user name; avatarIdx is derived
 * from the user id (0..7 → /avatar-N.png).
 */
export async function postChatMessage(user: User, body: string): Promise<ChatMessage> {
  const db = getDb();
  const club = await findClubByUserId(user.id);
  const name = (club?.name ?? user.name ?? "Manager").slice(0, 60);
  const avatarIdx = Math.abs(Number(user.id)) % 8;

  const [{ id }] = await db
    .insert(chatMessages)
    .values({ userId: user.id, name, avatarIdx, body })
    .$returningId();
  return (await db.query.chatMessages.findFirst({
    where: eq(chatMessages.id, id),
  }))!;
}
