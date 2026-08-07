import { execaCommand } from "execa";
import type { JobConfig } from "../types.js";
import { parseDuration } from "../utils/duration.js";

export interface CommandResult {
  success: boolean;
  exitCode?: number;
  signal?: string;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: Error;
}

export async function executeCommand(job: JobConfig): Promise<CommandResult> {
  try {
    const result = await execaCommand(job.command, {
      shell: true,
      cwd: job.cwd,
      env: job.env,
      reject: false,
      timeout: job.timeout ? parseDuration(job.timeout, `${job.name}.timeout`) : undefined,
    });
    return {
      success: result.exitCode === 0 && !result.timedOut,
      exitCode: result.exitCode,
      signal: result.signal ?? undefined,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      timedOut: result.timedOut ?? false,
    };
  } catch (error) {
    const typed = error as Error & { timedOut?: boolean; exitCode?: number; signal?: string; stdout?: string; stderr?: string };
    return {
      success: false,
      exitCode: typed.exitCode,
      signal: typed.signal,
      stdout: typed.stdout ?? "",
      stderr: typed.stderr ?? "",
      timedOut: typed.timedOut ?? false,
      error: typed,
    };
  }
}
