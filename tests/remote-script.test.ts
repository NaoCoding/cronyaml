import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { normalizeGitHubSource, resolveRemoteScript } from "../src/executor/remote-script.js";

describe("remote scripts", () => {
  it("converts a GitHub file URL into a raw URL", () => {
    expect(normalizeGitHubSource("https://github.com/example/scripts/blob/main/hello.sh"))
      .toBe("https://raw.githubusercontent.com/example/scripts/main/hello.sh");
  });

  it("downloads and caches a script while preserving arguments", async () => {
    const cacheDirectory = mkdtempSync(join(tmpdir(), "cronyaml-cache-"));
    const fetchImpl = vi.fn(async () => new Response("print('hello')\n", { status: 200 }));
    const result = await resolveRemoteScript(
      "https://raw.githubusercontent.com/example/scripts/main/hello.py",
      undefined,
      ["world"],
      { cacheDirectory, fetchImpl },
    );

    expect(result.file).toBe("python");
    expect(result.args[1]).toBe("world");
    expect(readFileSync(result.args[0] as string, "utf8")).toBe("print('hello')\n");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("uses the cached script when GitHub is temporarily unavailable", async () => {
    const cacheDirectory = mkdtempSync(join(tmpdir(), "cronyaml-cache-"));
    const source = "https://raw.githubusercontent.com/example/scripts/main/hello.js";
    const first = await resolveRemoteScript(source, undefined, [], {
      cacheDirectory,
      fetchImpl: async () => new Response("console.log('cached')\n", { status: 200 }),
    });
    const result = await resolveRemoteScript(source, undefined, [], {
      cacheDirectory,
      fetchImpl: async () => { throw new Error("offline"); },
      useCached: true,
    });

    expect(result.args[0]).toBe(first.args[0]);
    expect(readFileSync(result.args[0] as string, "utf8")).toContain("cached");
  });

  it("does not use the cached script unless useCached is enabled", async () => {
    const cacheDirectory = mkdtempSync(join(tmpdir(), "cronyaml-cache-"));
    const source = "https://raw.githubusercontent.com/example/scripts/main/hello.js";
    await resolveRemoteScript(source, undefined, [], {
      cacheDirectory,
      fetchImpl: async () => new Response("console.log('cached')\n", { status: 200 }),
    });

    await expect(resolveRemoteScript(source, undefined, [], {
      cacheDirectory,
      fetchImpl: async () => { throw new Error("offline"); },
    })).rejects.toThrow("failed to download");
  });
});
