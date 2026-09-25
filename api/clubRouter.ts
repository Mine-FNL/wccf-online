import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import {
  collectionWithCounts,
  getOrCreateClub,
  listClubs,
  updateClub,
} from "./queries/clubs";

/** "4-4-2" style — 3 or 4 lines of 1..5 summing to 10 outfielders. */
const formationSchema = z
  .string()
  .regex(/^[1-5](-[1-5]){2,3}$/, "Invalid formation")
  .refine(
    (f) => f.split("-").reduce((a, n) => a + Number(n), 0) === 10,
    "Formation must have 10 outfield players",
  );

const lineupSchema = z
  .array(
    z.object({
      slot: z.number().int().min(0).max(10),
      cardId: z.string().max(40).nullable(),
      kp: z.boolean(),
    }),
  )
  .length(11, "Lineup must have 11 slots")
  .refine(
    (slots) => new Set(slots.map((s) => s.slot)).size === 11,
    "Lineup slots must be unique 0..10",
  );

const trainingSchema = z.object({
  off: z.number().int().min(0).max(5),
  def: z.number().int().min(0).max(5),
  pas: z.number().int().min(0).max(5),
  pos: z.number().int().min(0).max(5),
  spe: z.number().int().min(0).max(5),
  pow: z.number().int().min(0).max(5),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected #RRGGBB");

export const clubRouter = createRouter({
  /** Get the caller's club; creates club + 18-card starter squad on first call. */
  me: authedQuery.query(async ({ ctx }) => {
    const { club, collection } = await getOrCreateClub(ctx.user.id);
    return { club, collection };
  }),

  update: authedQuery
    .input(
      z.object({
        name: z.string().trim().min(1).max(60).optional(),
        shortName: z.string().trim().min(1).max(4).optional(),
        kitPrimary: hexColor.optional(),
        kitSecondary: hexColor.optional(),
        formation: formationSchema.optional(),
        lineup: lineupSchema.optional(),
        training: trainingSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patch: Parameters<typeof updateClub>[1] = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.shortName !== undefined)
        patch.shortName = input.shortName.toUpperCase();
      if (input.kitPrimary !== undefined) patch.kitPrimary = input.kitPrimary;
      if (input.kitSecondary !== undefined)
        patch.kitSecondary = input.kitSecondary;
      if (input.formation !== undefined) patch.formation = input.formation;
      if (input.lineup !== undefined) patch.lineupJson = input.lineup;
      if (input.training !== undefined) patch.trainingJson = input.training;
      if (Object.keys(patch).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nothing to update" });
      }
      const club = await updateClub(ctx.user.id, patch);
      if (!club) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Club not found — call club.me first" });
      }
      return { club };
    }),

  /** Public paginated club directory, ordered by rating desc. */
  list: publicQuery
    .input(
      z.object({
        q: z.string().trim().max(60).optional(),
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(({ input }) => listClubs(input.q, input.limit, input.offset)),
});

export const cardsRouter = createRouter({
  /** Owned cards with counts. */
  collection: authedQuery.query(async ({ ctx }) => {
    const cards = await collectionWithCounts(ctx.user.id);
    return { cards };
  }),
});
