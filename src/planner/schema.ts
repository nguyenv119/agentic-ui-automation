import { z } from "zod";

export const StepSchema = z.object({
  step: z.number(),
  description: z.string(),
  action: z.enum(["goto", "click", "type", "wait"]),
  selector: z.string().nullable(),
  fallbackSelectors: z.array(z.string()).optional(),
  value: z.string().nullable().optional(),
  capture: z.boolean().optional().nullable(),
  tags: z.array(z.string()).optional(),
  expectsNavigation: z.boolean().optional(),
  expectSelector: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export const PlanSchema = z.object({
  app: z.string().optional(),
  task: z.string().optional(),
  steps: z.array(StepSchema)
});

export type Plan = z.infer<typeof PlanSchema>;
export type Step = z.infer<typeof StepSchema>;
