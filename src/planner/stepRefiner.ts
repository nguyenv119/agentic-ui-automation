// src/planner/stepRefiner.ts
import { DomSummary } from "../executor/domSummary";
import { logger } from "../utils/logger";
import { getOpenAIClient } from "../config/openai";
import { STEP_REFINER_PROMPT } from "../config/constants";
import { OPENAI_MODEL_DEFAULT } from "../config/constants";
import { cleanJsonResponse } from "../utils/helpers";
import { SemanticStep } from "./schema";

export type RefinedActionType = "goto" | "click" | "type" | "wait";

export interface RefinedStep {
  step: number;
  description: string;
  action: RefinedActionType;
  selector: string | null;
  fallbackSelectors: string[];
  value: string | null;
  capture: boolean;
  expectSelector?: string;
}

export interface PlanMetadataForRefiner {
  app: string;
  task: string;
  startUrl: string;
  previousSteps?: Array<{step: number; action: string; description: string}>;
}

export async function refineStep(
  planMetadata: PlanMetadataForRefiner,
  semanticStep: SemanticStep,
  domSummary: DomSummary
): Promise<RefinedStep | null> {
  logger.debug(
    `[refineStep] Refining step ${semanticStep.step}: "${semanticStep.goal}"`
  );

  const client = getOpenAIClient();
  const inputPayload = {
    plan: planMetadata,
    step: semanticStep,
    dom: domSummary,
  };

  try {
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL_DEFAULT,
      messages: [
        {
          role: "system",
          content: STEP_REFINER_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify(inputPayload),
        },
      ],
      temperature: 0.1,
    });

    const rawText = response.choices[0].message?.content ?? "{}";

    const cleanedContent = cleanJsonResponse(rawText);
    const parsed = JSON.parse(cleanedContent) as RefinedStep;

    if (
      !parsed ||
      typeof parsed.action !== "string" ||
      !["goto", "click", "type", "wait"].includes(parsed.action)
    ) {
      throw new Error(`Invalid action in parsed RefinedStep: ${parsed.action}`);
    }

    const refined: RefinedStep = {
      step: parsed.step ?? semanticStep.step,
      description:
        parsed.description || `Refined action for goal: ${semanticStep.goal}`,
      action: parsed.action,
      selector: parsed.selector ?? null,
      fallbackSelectors: parsed.fallbackSelectors ?? [],
      value: parsed.value ?? null,
      capture: parsed.capture ?? true,
      expectSelector: parsed.expectSelector,
    };

    return refined;
  } catch (error) {
    logger.warn(
      `[refineStep] LLM refinement failed, falling back to stub wait: ${
        error instanceof Error ? error.message : String(error)
      }`
    );

    return null;
  }
}
