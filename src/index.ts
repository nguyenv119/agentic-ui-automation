import { getEnv, loadEnv } from "./utils/env";
import { createServer } from "./server";

loadEnv();
const AGENT_B_PORT = getEnv("AGENT_B_PORT");
const app = createServer();

app.listen(AGENT_B_PORT, () => console.log(`Agent B running on PORT: ${AGENT_B_PORT}`));