import pc from "picocolors";

export function timestamp(): string {
  return new Date().toLocaleTimeString([], { hour12: false });
}

export function info(message: string): void { console.log(message); }
export function success(message: string): void { console.log(`${pc.green("✓")} ${message}`); }
export function warn(message: string): void { console.warn(`${pc.yellow("⚠")} ${message}`); }
export function failure(message: string): void { console.error(`${pc.red("✗")} ${message}`); }

export function jobOutput(jobName: string, output: string): void {
  for (const line of output.trimEnd().split(/\r?\n/)) if (line) console.log(`[${jobName}] ${line}`);
}
