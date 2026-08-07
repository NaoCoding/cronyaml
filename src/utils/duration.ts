import ms from "ms";
import { ConfigError } from "../errors.js";

export function parseDuration(value: string, field = "duration"): number {
  const parsed = ms(value);
  if (typeof parsed !== "number" || parsed < 0) {
    throw new ConfigError(`Invalid ${field}: ${JSON.stringify(value)}`);
  }
  return parsed;
}
