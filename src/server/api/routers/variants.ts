import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const variantInputSchema = z
  .object({
    id: z.string().cuid().optional(),
    key: z.string().trim().min(1, "Key is required.").max(32),
    weight: z
      .number({
        required_error: "Weight is required.",
        invalid_type_error: "Weight must be a number.",
      })
      .int("Weight must be an integer.")
      .min(0, "Weight must be at least 0.")
      .max(100, "Weight cannot exceed 100."),
  })
  .transform((variant) => ({
    ...variant,
    key: variant.key.trim().toUpperCase(),
  }));

const variantsInputSchema = z
  .array(variantInputSchema)
  .min(2, "Provide at least two variants.")
  .superRefine((variants, ctx) => {
    const seen = new Set<string>();
    for (const variant of variants) {
      if (seen.has(variant.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate key "${variant.key}".`,
        });
      } else {
        seen.add(variant.key);
      }
    }
  });

export const variantsRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ experimentId: z.string().cuid() }))
    .query(({ ctx, input }) => {
      return ctx.db.variant.findMany({
        where: { experimentId: input.experimentId },
        orderBy: [{ createdAt: "asc" }],
      });
    }),

  upsertMany: publicProcedure
    .input(
      z.object({
        experimentId: z.string().cuid(),
        variants: variantsInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { experimentId, variants } = input;

      return ctx.db.$transaction(async (tx) => {
        const existing = await tx.variant.findMany({
          where: { experimentId },
        });

        const incomingIds = variants
          .map((variant) => variant.id)
          .filter((id): id is string => Boolean(id));
        const idsToDelete = existing
          .filter((variant) => !incomingIds.includes(variant.id))
          .map((variant) => variant.id);

        if (idsToDelete.length > 0) {
          await tx.variant.deleteMany({
            where: { id: { in: idsToDelete } },
          });
        }

        const results = [];

        for (const variant of variants) {
          const data = {
            key: variant.key,
            weight: variant.weight,
          };

          if (variant.id) {
            const updated = await tx.variant.update({
              where: { id: variant.id },
              data,
            });
            results.push(updated);
          } else {
            const created = await tx.variant.create({
              data: {
                ...data,
                experimentId,
              },
            });
            results.push(created);
          }
        }

        return results;
      });
    }),
});
