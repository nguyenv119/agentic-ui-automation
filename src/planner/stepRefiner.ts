// src/planner/stepRefiner.ts
import { DomSummary } from "../executor/domSummary";
import { logger } from "../utils/logger";
import { getOpenAIClient } from "../config/openai";
import { STEP_REFINER_PROMPT } from "../config/constants";
import { OPENAI_MODEL_DEFAULT } from "../config/constants";
import { cleanJsonResponse } from "../utils/helpers";

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
}

export interface SemanticStep {
  step: number;
  goal: string;
  context?: string;
}

export async function refineStep(
  planMetadata: PlanMetadataForRefiner,
  semanticStep: SemanticStep,
  domSummary: DomSummary
): Promise<RefinedStep | null> {
  logger.debug(
    `[refineStep] Refining step ${semanticStep.step}: "${semanticStep.goal}"`
  );

  if (semanticStep.step === 1) {
    logger.debug(
      `[refineStep] Step 1 detected, returning deterministic goto to ${planMetadata.startUrl}`
    );
    return {
      step: semanticStep.step,
      description: "Navigate to the workspace start URL via refiner.",
      action: "goto",
      selector: planMetadata.startUrl,
      fallbackSelectors: [],
      value: null,
      capture: false,
    };
  }

  const client = getOpenAIClient();
  const inputPayload = {
    plan: planMetadata,
    step: semanticStep,
    dom: domSummary,
  };

  //   logger.debug(
  //     `[refineStep] Sending payload to STEP_REFINER LLM: ${JSON.stringify(
  //       inputPayload
  //     ).slice(0, 4000)}`
  //   );

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
    // logger.debug(
    //   `[refineStep] Cleaned JSON content: ${cleanedContent.slice(0, 4000)}`
    // );

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
