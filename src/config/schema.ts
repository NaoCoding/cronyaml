import { z } from "zod";

export const rawJobSchema = z.object({
  schedule: z.string().min(1),
  command: z.string().min(1),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  timeout: z.string().optional(),
  enabled: z.boolean().optional(),
  timezone: z.string().optional(),
  concurrency: z.object({ policy: z.enum(["allow", "forbid"]) }).optional(),
  retry: z.object({ attempts: z.number().int().min(1).max(100), delay: z.string().optional() }).optional(),
});

export const rawConfigSchema = z.object({
  version: z.literal(1),
  defaults: z.object({ timezone: z.string().optional(), timeout: z.string().optional() }).optional(),
  jobs: z.record(rawJobSchema).refine((jobs) => Object.keys(jobs).length > 0, "must contain at least one job"),
});
