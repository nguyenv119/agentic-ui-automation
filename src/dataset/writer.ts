import { mkdirSync, writeFileSync } from "fs";
import path from "path";

import { logger } from "../utils/logger";
import { ExecutedStep } from "../executor/executor";

export const initStorage = (taskId="agent_b_workflow") => {
  const runId = `${taskId}_${Date.now()}`;

  const datasetDir = path.join(__dirname, "runs", runId);
  const screenshotsDir = path.join(datasetDir, "screenshots");

  logger.info(`Creating dataset directory: ${datasetDir}`);
  mkdirSync(datasetDir, { recursive: true });

  logger.info(`Creating screenshots directory: ${screenshotsDir}`);
  mkdirSync(screenshotsDir, { recursive: true });

  const workflowFile = path.join(datasetDir, "agent_b_workflow.json");

  logger.info(`Workflow JSON will be written to: ${workflowFile}`);

  return {
    datasetDir,
    screenshotsDir,
    workflowFile,
  };
};

export const writeWorkflowJSON = (file: string, steps: ExecutedStep[]) => {
  writeFileSync(file, JSON.stringify({ steps }, null, 2));
  logger.info(`Workflow written to ${file}`);
};
