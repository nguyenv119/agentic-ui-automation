import { z } from "zod";

export const StepSchema = z.object({
  step: z.number(),
  description: z.string(),
  action: z.enum(["goto", "click", "type", "wait"]),
});

export const PlanSchema = z.object({
  steps: z.array(StepSchema)
});

export type Plan = z.infer<typeof PlanSchema>;
export type Step = z.infer<typeof StepSchema>;
