import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { extname, join, resolve } from "node:path";
import type { ScriptRuntime } from "../types.js";

const SUPPORTED_HOSTS = new Set(["github.com", "www.github.com", "raw.githubusercontent.com"]);

export class RemoteScriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoteScriptError";
  }
}

export function normalizeGitHubSource(source: string): string {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new RemoteScriptError(`source is not a valid URL: ${JSON.stringify(source)}`);
  }
  if (url.protocol !== "https:" || !SUPPORTED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new RemoteScriptError("source must be an HTTPS GitHub file URL");
  }
  if (url.hostname.toLowerCase() === "raw.githubusercontent.com") return url.toString();

  const parts = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  if (parts.length < 5 || (parts[2] !== "blob" && parts[2] !== "raw") || !parts[3]) {
    throw new RemoteScriptError("source must point to a GitHub file, for example /owner/repo/blob/main/script.sh");
  }
  const [owner, repository, , ref, ...filePath] = parts;
  if (!filePath.length) throw new RemoteScriptError("source must include a script file path");
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeURIComponent(ref)}/${filePath.map(encodeURIComponent).join("/")}`;
}

function defaultCacheDirectory(): string {
  const cacheRoot = process.platform === "win32"
    ? process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local")
    : process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
  return resolve(cacheRoot, "cronyaml", "scripts");
}

function inferRuntime(source: string, runtime?: ScriptRuntime): ScriptRuntime {
  if (runtime) return runtime;
  const extension = extname(new URL(source).pathname).toLowerCase();
  const inferred: Record<string, ScriptRuntime> = {
    ".sh": "bash",
    ".bash": "bash",
    ".py": "python",
    ".js": "node",
    ".mjs": "node",
    ".cjs": "node",
    ".ps1": "powershell",
  };
  const result = inferred[extension];
  if (!result) throw new RemoteScriptError(`cannot infer runtime for ${extension || "a script without an extension"}; set source runtime explicitly`);
  return result;
}

function runtimeCommand(runtime: ScriptRuntime): string {
  if (runtime === "powershell") return process.platform === "win32" ? "powershell" : "pwsh";
  return runtime;
}

export interface ResolvedRemoteScript {
  file: string;
  args: string[];
}

export interface RemoteScriptOptions {
  cacheDirectory?: string;
  fetchImpl?: typeof fetch;
  useCached?: boolean;
}

export async function resolveRemoteScript(source: string, runtime: ScriptRuntime | undefined, args: string[], options: RemoteScriptOptions = {}): Promise<ResolvedRemoteScript> {
  const normalizedSource = normalizeGitHubSource(source);
  const selectedRuntime = inferRuntime(normalizedSource, runtime);
  const cacheDirectory = options.cacheDirectory ?? defaultCacheDirectory();
  const sourceHash = createHash("sha256").update(normalizedSource).digest("hex");
  const extension = extname(new URL(normalizedSource).pathname) || ".script";
  const cachedFile = join(cacheDirectory, `${sourceHash}${extension}`);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) throw new RemoteScriptError("this Node.js runtime does not provide fetch");

  try {
    const response = await fetchImpl(normalizedSource, { headers: { "user-agent": "cronyaml" } });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const content = await response.text();
    if (!content.trim()) throw new Error("the downloaded script is empty");
    mkdirSync(cacheDirectory, { recursive: true });
    writeFileSync(cachedFile, content, "utf8");
  } catch (error) {
    if (!options.useCached || !existsSync(cachedFile)) {
      throw new RemoteScriptError(`failed to download ${source}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { file: runtimeCommand(selectedRuntime), args: [cachedFile, ...args] };
}
