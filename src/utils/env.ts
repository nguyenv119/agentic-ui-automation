import { config } from "dotenv";
import { resolve } from "path";

export const loadEnv = () => {
  config({ path: resolve(__dirname, "../../.env") });
};

export const getEnv = (key: string) => {
  return process.env[key];
};