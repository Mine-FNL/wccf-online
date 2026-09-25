import {
  mysqlTable,
  mysqlEnum,
  serial,
  bigint,
  int,
  json,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/* ------------------------------------------------------------------ */
/* WCCF Online — app tables (see design/backend-spec.md)               */
/* ------------------------------------------------------------------ */

/** One manager club per user. */
export const clubs = mysqlTable(
  "clubs",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .unique(),
    name: varchar("name", { length: 60 }).notNull().default("New Club FC"),
    /** scorebug chip */
    shortName: varchar("shortName", { length: 4 }).notNull().default("NEW"),
    kitPrimary: varchar("kitPrimary", { length: 7 })
      .notNull()
      .default("#FF8A1E"),
    kitSecondary: varchar("kitSecondary", { length: 7 })
      .notNull()
      .default("#12161F"),
    formation: varchar("formation", { length: 8 }).notNull().default("4-4-2"),
    /** array of 11 slots: { slot: 0..10, cardId: string|null, kp: boolean } */
    lineupJson: json("lineupJson"),
    /** { off,def,pas,pos,spe,pow } each 0..5 */
    trainingJson: json("trainingJson"),
    rating: int("rating").notNull().default(1500),
    credits: int("credits").notNull().default(500),
    wins: int("wins").notNull().default(0),
    draws: int("draws").notNull().default(0),
    losses: int("losses").notNull().default(0),
    goalsFor: int("goalsFor").notNull().default(0),
    goalsAgainst: int("goalsAgainst").notNull().default(0),
    unbeatenStreak: int("unbeatenStreak").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    ratingIdx: index("clubs_rating_idx").on(table.rating),
  }),
);

export type Club = typeof clubs.$inferSelect;
export type InsertClub = typeof clubs.$inferInsert;

/** Card copies owned by a user; `cardId` matches cards.json `id`. */
export const cardsOwned = mysqlTable(
  "cardsOwned",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    cardId: varchar("cardId", { length: 40 }).notNull(),
    /** 'starter' | 'reward' | 'scout-pro' | 'scout-elite' */
    source: varchar("source", { length: 20 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userCardIdx: index("cardsOwned_user_card_idx").on(
      table.userId,
      table.cardId,
    ),
  }),
);

export type CardOwned = typeof cardsOwned.$inferSelect;
export type InsertCardOwned = typeof cardsOwned.$inferInsert;

/** A completed cabinet match reported by the client. */
export const matches = mysqlTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    cabinetId: varchar("cabinetId", { length: 30 }).notNull(),
    cabinetVersion: varchar("cabinetVersion", { length: 20 }).notNull(),
    opponentName: varchar("opponentName", { length: 60 }).notNull(),
    scoreFor: int("scoreFor").notNull(),
    scoreAgainst: int("scoreAgainst").notNull(),
    /** 'W' | 'D' | 'L' */
    result: varchar("result", { length: 1 }).notNull(),
    /** condensed event list [{min, type, team, player, detail}] */
    timelineJson: json("timelineJson"),
    rewardCardId: varchar("rewardCardId", { length: 40 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("matches_user_idx").on(table.userId),
    createdAtIdx: index("matches_createdAt_idx").on(table.createdAt),
  }),
);

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;

/**
 * Online records. A NEW row is inserted every time a record is broken, so the
 * table doubles as the ticker history; the current holder per category is the
 * latest row of that category.
 */
export const records = mysqlTable(
  "records",
  {
    id: serial("id").primaryKey(),
    /**
     * 'TOP_RATING' | 'MOST_GOALS_MATCH' | 'BIGGEST_WIN' | 'LONGEST_UNBEATEN'
     */
    category: varchar("category", { length: 40 }).notNull(),
    holderUserId: bigint("holderUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    /** snapshot of the club name at record time */
    holderClubName: varchar("holderClubName", { length: 60 }).notNull(),
    value: int("value").notNull(),
    /** e.g. "9–0 vs AC Torino" */
    detail: varchar("detail", { length: 120 }).notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    categoryIdx: index("records_category_idx").on(table.category),
    createdAtIdx: index("records_createdAt_idx").on(table.createdAt),
  }),
);

export type Record = typeof records.$inferSelect;
export type InsertRecord = typeof records.$inferInsert;

/** Lobby chat. */
export const chatMessages = mysqlTable(
  "chatMessages",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    /** snapshot of club name (or user name) at post time */
    name: varchar("name", { length: 60 }).notNull(),
    /** 0..7 → /avatar-N.png */
    avatarIdx: int("avatarIdx").notNull().default(0),
    body: varchar("body", { length: 280 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("chatMessages_createdAt_idx").on(table.createdAt),
  }),
);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// Note: FK columns referencing a serial() PK must use:
//   bigint("columnName", { mode: "number", unsigned: true }).notNull()
