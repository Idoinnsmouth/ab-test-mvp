import { z } from "zod";

export const experimentStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
]);

export type ExperimentStatus = z.infer<typeof experimentStatusSchema>;

export const snakeCaseNameSchema = z
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

export const ensureChronologicalSchedule = (
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

export const experimentInputSchema = experimentBaseSchema.superRefine(
  ensureChronologicalSchedule,
);
export type ExperimentInput = z.infer<typeof experimentInputSchema>;

export const experimentUpdateSchema = experimentBaseSchema
  .extend({
    id: z.string().cuid(),
  })
  .superRefine(ensureChronologicalSchedule);
export type ExperimentUpdateInput = z.infer<typeof experimentUpdateSchema>;

export const listExperimentsInputSchema = z
  .object({
    search: z.string().trim().min(1).max(64).optional(),
    status: z.array(experimentStatusSchema).min(1).optional(),
    cursor: z.string().cuid().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .optional();
export type ListExperimentsInput = z.infer<typeof listExperimentsInputSchema>;

export type ExperimentBase = z.infer<typeof experimentBaseSchema>;
