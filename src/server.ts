import express from "express";
import { generatePlan } from "./planner/planner";
import { runPlan } from "./executor/executor";
import { initDataset, writeWorkflowJSON } from "./dataset/writer";

export function createServer() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_, res) => {
    res.json({ success: true, message: "Agent B Server is healthy" });
  });

  app.post("/run_workflow", async (req, res) => {
    const { agentATask } = req.body;
    const agentBPlan = await generatePlan(agentATask);
    const dir = initDataset();
    const steps = await runPlan();
    writeWorkflowJSON(dir, { agentATask, agentBPlan, steps });
    res.json({ success: true, dir, steps });
  });

  return app;
}