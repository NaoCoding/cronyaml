import { execa, execaCommand } from "execa";
import type { JobConfig } from "../types.js";
import { parseDuration } from "../utils/duration.js";
import { resolveRemoteScript } from "./remote-script.js";

export interface JobInvocation {
  args?: string[];
  env?: Record<string, string>;
}

export interface CommandResult {
  success: boolean;
  exitCode?: number;
  signal?: string;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: Error;
}

export async function executeCommand(job: JobConfig, invocation: JobInvocation = {}): Promise<CommandResult> {
  try {
    const options = {
      cwd: job.cwd,
      env: { ...job.env, ...invocation.env },
      reject: false,
      timeout: job.timeout ? parseDuration(job.timeout, `${job.name}.timeout`) : undefined,
    };
    const args = [...(job.args ?? []), ...(invocation.args ?? [])];
    const result = job.source
      ? await resolveRemoteScript(job.source, job.runtime, args, { useCached: job.useCached })
        .then(({ file, args }) => execa(file, args, options))
      : await execaCommand(appendCommandArgs(job.command as string, args), { ...options, shell: true });
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

function appendCommandArgs(command: string, args: string[]): string {
  if (!args.length) return command;
  return `${command} ${args.map((arg) => JSON.stringify(arg)).join(" ")}`;
}
