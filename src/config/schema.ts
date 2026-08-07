import { z } from "zod";

export const rawJobSchema = z.object({
  schedule: z.string().min(1),
  command: z.string().min(1).optional(),
  source: z.string().url().optional(),
  runtime: z.enum(["bash", "sh", "node", "python", "powershell"]).optional(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  timeout: z.string().optional(),
  enabled: z.boolean().optional(),
  timezone: z.string().optional(),
  concurrency: z.object({ policy: z.enum(["allow", "forbid"]) }).optional(),
  retry: z.object({ attempts: z.number().int().min(1).max(100), delay: z.string().optional() }).optional(),
}).superRefine((job, context) => {
  if ((job.command === undefined) === (job.source === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "define exactly one of command or source", path: ["command"] });
  }
  if (job.source === undefined && (job.runtime !== undefined || job.args !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtime and args require source", path: ["source"] });
  }
});

export const rawConfigSchema = z.object({
  version: z.literal(1),
  defaults: z.object({ timezone: z.string().optional(), timeout: z.string().optional() }).optional(),
  jobs: z.record(rawJobSchema).refine((jobs) => Object.keys(jobs).length > 0, "must contain at least one job"),
});
