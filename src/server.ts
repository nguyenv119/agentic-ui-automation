import express from "express";
import { generatePlan } from "./planner/planner";
import { logger } from "./utils/logger";
import { runPlan } from "./executor/executor";
import { initDataset, writeWorkflowJSON } from "./dataset/writer";

export function createServer() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_, res) => {
    logger.info("Agent B Server is healthy");
    res.json({ success: true, message: "Agent B Server is healthy" });
  });

  app.post("/run_workflow", async (req, res) => {
    const { agentATask } = req.body;
    logger.info(`Received task from Agent A: ${agentATask}`);
    const agentBPlan = await generatePlan(agentATask);
    res.json({ success: true, agentBPlan });
    const dir = initDataset();
    const steps = await runPlan();
    writeWorkflowJSON(dir, { agentATask, agentBPlan, steps });
    res.json({ success: true, dir, steps });
  });

  return app;
}