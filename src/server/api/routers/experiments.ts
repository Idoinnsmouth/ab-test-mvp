import type { Prisma } from "../../../../generated/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  experimentInputSchema,
  experimentUpdateSchema,
  listExperimentsInputSchema,
} from "~/features/experiments/schemas";
import type { ExperimentBase } from "~/features/experiments/schemas";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const normalizeDates = (data: ExperimentBase) => ({
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
  list: publicProcedure.input(listExperimentsInputSchema).query(async ({ ctx, input }) => {
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
      include: {
        _count: {
          select: {
            variants: true,
          },
        },
      },
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
