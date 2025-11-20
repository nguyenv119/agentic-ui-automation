import OpenAI from "openai";
import { getEnv } from "../utils/env";
import { logger } from "../utils/logger";

let openAIClient: OpenAI | null = null;

/**
 * Gets the singleton OpenAI client instance.
 * Creates the instance lazily on first access.
 * 
 * @returns The singleton OpenAI client instance
 * @throws Error if OPENAI_API_KEY is not set
 */
export function getOpenAIClient(): OpenAI {
  if (!openAIClient) {
    logger.info("Creating OpenAI client");
    const apiKey = getEnv("OPENAI_API_KEY");
    if (!apiKey) {
      logger.error("OPENAI_API_KEY environment variable is not set");
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openAIClient = new OpenAI({
      apiKey,
    });
    logger.info("OpenAI client created");
  }
  return openAIClient;
}

/**
 * Resets the singleton instance (useful for testing).
 * @internal
 */
export function resetOpenAIClient(): void {
  logger.debug("Resetting OpenAI client");
  openAIClient = null;
}