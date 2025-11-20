import { getEnv } from "./env";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Gets the caller function name from the call stack.
 * Skips logger internals to find the actual calling function.
 * @returns The function name or "unknown" if not found
 */
function getCallerFunctionName(): string {
  try {
    const stack = new Error().stack;
    if (!stack) return "unknown";

    const stackLines = stack.split("\n");
    
    // Skip logger internals:
    // Line 0: Error constructor
    // Line 1: getCallerFunctionName() itself
    // Line 2: log() function
    // Line 3: logger.info/error/warn/debug arrow function
    // Line 4+: The actual calling function (what we want)
    
    for (let i = 4; i < stackLines.length; i++) {
      const line = stackLines[i];
      if (!line) continue;
      
      // Skip lines from logger.ts
      if (line.includes("logger.ts")) continue;
      
      // Skip Object.methodName patterns (these are the logger wrapper functions)
      if (line.includes("Object.")) continue;
      
      // Match function name patterns:
      // - "at functionName (file:line:column)"
      // - "at ClassName.methodName (file:line:column)"
      // - "at async functionName (file:line:column)"
      // - "at Promise.functionName (file:line:column)"
      const match = line.match(/at\s+(?:async\s+)?(?:Promise\.)?(?:new\s+)?([\w.]+)\s*\(/);
      if (match && match[1]) {
        const functionName = match[1];
        // Skip if it's still a logger-related name
        if (functionName === "log" || functionName.startsWith("Object.")) {
          continue;
        }
        return functionName;
      }
      
      // Fallback: try to extract from anonymous functions or other patterns
      const anonymousMatch = line.match(/at\s+([^(\s]+)/);
      if (anonymousMatch && anonymousMatch[1] && !anonymousMatch[1].includes("Object.")) {
        return anonymousMatch[1];
      }
    }
    
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Formats timestamp in ISO-like format: YYYY-MM-DD HH:mm:ss.SSS
 */
function formatTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * Gets the current log level threshold based on environment.
 * Development: shows all logs (debug, info, warn, error)
 * Production: shows info, warn, error (hides debug)
 */
function getLogLevelThreshold(): number {
  const env = getEnv("NODE_ENV") || "development";
  const logLevel = getEnv("LOG_LEVEL")?.toLowerCase();

  // Explicit LOG_LEVEL env var takes precedence
  if (logLevel && logLevel in LOG_LEVELS) {
    return LOG_LEVELS[logLevel as LogLevel];
  }

  // Environment-based defaults
  if (env === "production") {
    return LOG_LEVELS.info; // Hide debug in production
  }

  return LOG_LEVELS.debug; // Show all in development
}

/**
 * Formats log message with timestamp, level, function name, and message
 */
function formatLogMessage(
  level: LogLevel,
  functionName: string,
  message: string,
  data?: any
): string {
  const timestamp = formatTimestamp();
  const levelUpper = level.toUpperCase();
  const functionPart = `[${functionName}]`;

  let logLine = `[${timestamp}] [${levelUpper}] ${functionPart} ${message}`;

  if (data !== undefined) {
    // Format data nicely
    if (data instanceof Error) {
      logLine += `\n${data.stack || data.message}`;
    } else if (typeof data === "object") {
      logLine += `\n${JSON.stringify(data, null, 2)}`;
    } else {
      logLine += ` ${String(data)}`;
    }
  }

  return logLine;
}

/**
 * Core logging function that all log methods use
 */
function log(level: LogLevel, message: string, data?: any): void {
  const threshold = getLogLevelThreshold();
  const levelValue = LOG_LEVELS[level];

  // Skip if log level is below threshold
  if (levelValue < threshold) {
    return;
  }

  const functionName = getCallerFunctionName();
  const formattedMessage = formatLogMessage(level, functionName, message, data);

  // Use appropriate console method
  switch (level) {
    case "error":
      console.error(formattedMessage);
      break;
    case "warn":
      console.warn(formattedMessage);
      break;
    case "info":
      console.info(formattedMessage);
      break;
    case "debug":
      console.debug(formattedMessage);
      break;
  }
}

/**
 * Logger utility with automatic function name detection and environment-based log levels.
 * 
 * @example
 * ```typescript
 * import { logger } from "./utils/logger";
 * 
 * logger.info("Operation completed");
 * logger.error("Something went wrong", error);
 * logger.warn("Deprecated feature used");
 * logger.debug("Detailed debug information");
 * ```
 */
export const logger = {
  /**
   * Logs an info message.
   * @param message - The log message
   * @param data - Optional data to include (object, error, or primitive)
   */
  info: (message: string, data?: any) => log("info", message, data),

  /**
   * Logs an error message.
   * @param message - The log message
   * @param data - Optional error object or data to include
   */
  error: (message: string, data?: any) => log("error", message, data),

  /**
   * Logs a warning message.
   * @param message - The log message
   * @param data - Optional data to include
   */
  warn: (message: string, data?: any) => log("warn", message, data),

  /**
   * Logs a debug message (hidden in production by default).
   * @param message - The log message
   * @param data - Optional data to include
   */
  debug: (message: string, data?: any) => log("debug", message, data),
};

