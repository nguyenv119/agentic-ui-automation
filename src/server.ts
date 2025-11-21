import express from "express";

import { generatePlan } from "./planner/planner";
import { logger } from "./utils/logger";
import { runPlan } from "./executor/executor";
import { initStorage, writeWorkflowJSON } from "./dataset/writer";

export function createServer() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_, res) => {
    logger.info("Agent B Server is healthy");
    res.json({ success: true, message: "Agent B Server is healthy" });
  });

  app.post("/run_workflow", async (req, res) => {
    const { agentATask } = req.body;
    const agentBPlan = await generatePlan(agentATask);
    const { workflowFile, screenshotsDir } = initStorage();

    const workflowOutput = await runPlan(agentBPlan, screenshotsDir);

    writeWorkflowJSON(workflowFile, workflowOutput.steps);
    res.json({ success: true, workflowOutput });
  });

  return app;
}
