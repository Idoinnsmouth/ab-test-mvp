import { randomInt } from "crypto";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const assignmentInputSchema = z.object({
  experimentId: z.string().cuid(),
  userId: z
    .string()
    .trim()
    .min(3, "User ID must be at least 3 characters.")
    .max(128, "User ID must be 128 characters or fewer."),
});

const sanitizeUserId = (value: string) => value.trim();

const pickVariant = (
  variants: Array<{ id: string; weight: number }>,
): string => {
  const nonNegative = variants.map((variant) => ({
    id: variant.id,
    weight: Math.max(0, variant.weight),
  }));
  const totalWeight = nonNegative.reduce(
    (total, variant) => total + variant.weight,
    0,
  );

  if (totalWeight <= 0) {
    const index = randomInt(variants.length);
    return variants[index]!.id;
  }

  const threshold = randomInt(totalWeight);
  let cumulative = 0;
  for (const variant of nonNegative) {
    cumulative += variant.weight;
    if (threshold < cumulative) {
      return variant.id;
    }
  }

  return nonNegative[nonNegative.length - 1]!.id;
};

export const assignmentsRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ experimentId: z.string().cuid() }).optional())
    .query(({ ctx, input }) => {
      if (!input?.experimentId) {
        return [];
      }

      return ctx.db.assignment.findMany({
        where: { experimentId: input.experimentId },
        include: { variant: true },
        orderBy: [{ createdAt: "desc" }],
      });
    }),

  get: publicProcedure
    .input(assignmentInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = sanitizeUserId(input.userId);

      const assignment = await ctx.db.assignment.findUnique({
        where: {
          experimentId_userId: {
            experimentId: input.experimentId,
            userId,
          },
        },
        include: {
          variant: true,
        },
      });

      if (!assignment) {
        return null;
      }

      return {
        id: assignment.id,
        userId: assignment.userId,
        experimentId: assignment.experimentId,
        variant: assignment.variant,
        createdAt: assignment.createdAt,
      };
    }),

  assign: publicProcedure
    .input(assignmentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = sanitizeUserId(input.userId);

      const existing = await ctx.db.assignment.findUnique({
        where: {
          experimentId_userId: {
            experimentId: input.experimentId,
            userId,
          },
        },
        include: {
          variant: true,
        },
      });

      if (existing) {
        return {
          id: existing.id,
          userId: existing.userId,
          experimentId: existing.experimentId,
          variant: existing.variant,
          createdAt: existing.createdAt,
        };
      }

      const variants = await ctx.db.variant.findMany({
        where: { experimentId: input.experimentId },
        orderBy: [{ createdAt: "asc" }],
      });

      if (variants.length < 2) {
        throw new Error("An experiment must have at least two variants.");
      }

      const chosenVariantId = pickVariant(
        variants.map((variant) => ({
          id: variant.id,
          weight: variant.weight,
        })),
      );

      const assignment = await ctx.db.assignment.create({
        data: {
          userId,
          experimentId: input.experimentId,
          variantId: chosenVariantId,
        },
        include: {
          variant: true,
        },
      });

      return {
        id: assignment.id,
        userId: assignment.userId,
        experimentId: assignment.experimentId,
        variant: assignment.variant,
        createdAt: assignment.createdAt,
      };
    }),
});
