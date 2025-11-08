import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env";

const assignmentInputSchema = z.object({
  experimentId: z.string().cuid(),
  userId: z
    .string()
    .trim()
    .min(3, "User ID must be at least 3 characters.")
    .max(128, "User ID must be 128 characters or fewer."),
});

const sanitizeUserId = (value: string) => value.trim();

type AssignmentServiceResponse = {
  experimentId: string;
  userId: string;
  variantKey: string;
};

const assignEndpoint = new URL("/assign", env.ASSIGNMENT_SERVICE_URL);

const callAssignmentService = async (
  experimentId: string,
  userId: string,
): Promise<AssignmentServiceResponse> => {
  let response: Response;
  try {
    response = await fetch(assignEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experimentId, userId }),
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    throw new Error(`Assignment service unreachable: ${message}`);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      detail?.trim()
        ? `Assignment service failed (${response.status}): ${detail}`
        : `Assignment service failed with status ${response.status}`,
    );
  }

  return (await response.json()) as AssignmentServiceResponse;
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

      const variantCount = await ctx.db.variant.count({
        where: { experimentId: input.experimentId },
      });

      if (variantCount < 2) {
        throw new Error("An experiment must have at least two variants.");
      }

      await callAssignmentService(input.experimentId, userId);

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
        throw new Error("Assignment service did not persist a result.");
      }

      return {
        id: assignment.id,
        userId: assignment.userId,
        experimentId: assignment.experimentId,
        variant: assignment.variant,
        createdAt: assignment.createdAt,
      };
    }),
});
