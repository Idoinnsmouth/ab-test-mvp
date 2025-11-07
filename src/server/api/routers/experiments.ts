import type { Prisma } from "../../../../generated/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const experimentStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
]);

const snakeCaseNameSchema = z
  .string()
  .min(3, "Name must be at least 3 characters.")
  .max(64, "Name must be 64 characters or fewer.")
  .regex(
    /^[a-z0-9]+(?:_[a-z0-9]+)*$/,
    "Only lowercase snake_case values are allowed.",
  );

const optionalDateSchema = z
  .union([z.date(), z.string().datetime()])
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) return null;
    return value instanceof Date ? value : new Date(value);
  });

const experimentBaseSchema = z.object({
  name: snakeCaseNameSchema,
  status: experimentStatusSchema.default("draft"),
  strategy: z.string().trim().min(1).max(64).default("uniform"),
  startAt: optionalDateSchema,
  endAt: optionalDateSchema,
});

const ensureChronologicalSchedule = (
  data: Pick<z.infer<typeof experimentBaseSchema>, "startAt" | "endAt">,
  ctx: z.RefinementCtx,
) => {
  if (data.startAt && data.endAt && data.endAt < data.startAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endAt"],
      message: "endAt must be after startAt.",
    });
  }
};

const experimentInputSchema = experimentBaseSchema.superRefine(
  ensureChronologicalSchedule,
);

const experimentUpdateSchema = experimentBaseSchema
  .extend({
    id: z.string().cuid(),
  })
  .superRefine(ensureChronologicalSchedule);

const listInputSchema = z
  .object({
    search: z.string().trim().min(1).max(64).optional(),
    status: z.array(experimentStatusSchema).min(1).optional(),
  })
  .optional();

const normalizeDates = (data: z.infer<typeof experimentBaseSchema>) => ({
  name: data.name,
  status: data.status,
  strategy: data.strategy,
  startAt: data.startAt ?? null,
  endAt: data.endAt ?? null,
});

const handlePrismaError = (error: unknown): never => {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An experiment with this name already exists.",
      });
    }

    if (error.code === "P2025") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Experiment not found.",
      });
    }
  }

  if (error instanceof Error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected error",
  });
};

export const experimentsRouter = createTRPCRouter({
  list: publicProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    const filters = input ?? {};
    const where: Prisma.ExperimentWhereInput = {};

    if (filters.search) {
      where.OR = [
        {
          name: {
            contains: filters.search.toLowerCase(),
          },
        },
        {
          strategy: {
            contains: filters.search.toLowerCase(),
          },
        },
      ];
    }

    if (filters.status) {
      where.status = {
        in: filters.status,
      };
    }

    return ctx.db.experiment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
    });
  }),

  create: publicProcedure
    .input(experimentInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.experiment.create({
          data: normalizeDates(input),
        });
      } catch (error) {
        handlePrismaError(error);
      }
    }),

  update: publicProcedure
    .input(experimentUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      try {
        return await ctx.db.experiment.update({
          where: { id },
          data: normalizeDates(data),
        });
      } catch (error) {
        handlePrismaError(error);
      }
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.experiment.delete({
          where: { id: input.id },
        });

        return { success: true };
      } catch (error) {
        handlePrismaError(error);
      }
    }),
});
