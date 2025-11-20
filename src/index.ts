import { getEnv, loadEnv } from "./utils/env";
import { createServer } from "./server";
import { logger } from "./utils/logger";

loadEnv();
const AGENT_B_PORT = getEnv("AGENT_B_PORT");
const app = createServer();

app.listen(AGENT_B_PORT, () => logger.info(`Agent B running on PORT: ${AGENT_B_PORT}`));