import { PlanSchema, Plan } from "./schema";
import { getOpenAIClient } from "../config/openai";
import { logger } from "../utils/logger";
import { cleanJsonResponse } from "../utils/helpers";

export async function generatePlan(task: string): Promise<Plan> {
  const openai = getOpenAIClient();
  const prompt = `
    You are a UI workflow planner. Given the task description below, output a JSON plan.

    Task:
    ${task}

    Rules:
    - Use only actions: goto, click, type, wait
    - DO NOT include explanations outside JSON

    Output ONLY valid JSON that matches this schema:
    {
      "steps": [
        {
          "step": 1,
          "description": "Navigate to Linear project list",
          "action": "goto"
        }
      ]
    }
  `;

  try {
    logger.debug("Requesting plan from OpenAI");
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });
    logger.debug("OpenAI responded");

    const rawContent = res.choices[0].message?.content || "{}";
    
    const cleanedContent = cleanJsonResponse(rawContent as string);
    logger.debug("Cleaned JSON content");
    
    let json;
    try {
      json = JSON.parse(cleanedContent);
    } catch (parseError) {
      logger.error("Failed to parse JSON from OpenAI response", {
        rawContent,
        cleanedContent,
        error: parseError
      });
      throw new Error(`Invalid JSON response from OpenAI: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    
    logger.debug("Parsed JSON from OpenAI");

    const { success, data, error } = PlanSchema.safeParse(json);
    if (!success) {
      logger.error("Invalid Zod schema for plan", error);
      throw new Error("Invalid Zod schema for plan");
    }
    logger.debug("Plan generated");
    return data;
  } catch (error) {
    logger.error("Error generating plan", error);
    throw error;
  }
}
