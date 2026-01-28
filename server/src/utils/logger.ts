import { config } from "../config";

/**
 * Tiny wrapper around console.log to enable/disable logging
 * @param value
 */
export const logger = (value: string) => {
  if (config.enableLogs !== "yes") {
    return;
  }

  console.log(value);
};
