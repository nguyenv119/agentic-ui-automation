// src/planner/schema.ts
import { z } from "zod";

export const StepSchema = z.object({
  step: z.number(),
  description: z.string(),
  action: z.enum(["goto", "click", "type", "wait"]),
  selector: z.string().nullable(),
  fallbackSelectors: z.array(z.string()).optional(),
  value: z.string().nullable().optional(),
  expectsNavigation: z.boolean().optional(),
  expectSelector: z.string().optional(),
  metadata: z
    .object({
      textHint: z.string().nullable().optional(),
      targetKind: z
        .enum(["button", "input", "menuItem", "container", "other"])
        .optional(),
      waitForHint: z.string().nullable().optional(),
    })
    .optional(),
});

export const PlanSchema = z.object({
  app: z.string().optional(),
  task: z.string().optional(),
  steps: z.array(StepSchema),
  metadata: z
    .object({
      useLiveRefiner: z.boolean().optional(),
    })
    .optional(),
});

export type Plan = z.infer<typeof PlanSchema>;
export type Step = z.infer<typeof StepSchema>;

// Semantic Planner Types (Internal use for LLM generation)
export interface SemanticStep {
  step: number;
  goal: string; // natural language
  actionHint?: "goto" | "click" | "type" | "wait";
  textHint?: string | null; // label or text we expect to interact with
  targetKind?: "button" | "input" | "menuItem" | "container" | "other";
  waitForHint?: string | null; // hint about what to wait for (e.g. "table element", "settings button")
}

export interface SemanticPlan {
  app: string;
  task: string;
  startUrl: string;
  steps: SemanticStep[];
}
