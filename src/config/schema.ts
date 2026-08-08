import { z } from "zod";

const rawFollowUpObjectSchema = z.object({
  job: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  parameters: z.record(z.string()).optional(),
  repeat: z.union([z.number().int().min(0).max(1000), z.string().min(1)]).optional(),
  for_each: z.string().min(1).optional(),
}).superRefine((followUp, context) => {
  if (followUp.repeat !== undefined && followUp.for_each !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "repeat and for_each are mutually exclusive", path: ["repeat"] });
  }
});

const rawFollowUpSchema = z.union([
  z.string().min(1),
  rawFollowUpObjectSchema,
]);

export const rawJobSchema = z.object({
  schedule: z.string().min(1).optional(),
  command: z.string().min(1).optional(),
  source: z.string().url().optional(),
  runtime: z.enum(["bash", "sh", "node", "python", "powershell"]).optional(),
  args: z.array(z.string()).optional(),
  "use-cached": z.boolean().optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  timeout: z.string().optional(),
  enabled: z.boolean().optional(),
  timezone: z.string().optional(),
  concurrency: z.object({ policy: z.enum(["allow", "forbid"]) }).optional(),
  retry: z.object({ attempts: z.number().int().min(1).max(100), delay: z.string().optional() }).optional(),
  if_success: rawFollowUpSchema.optional(),
  if_failed: rawFollowUpSchema.optional(),
}).superRefine((job, context) => {
  if ((job.command === undefined) === (job.source === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "define exactly one of command or source", path: ["command"] });
  }
  if (job.source === undefined && job.runtime !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtime requires source", path: ["source"] });
  }
  if (job.source === undefined && job["use-cached"] !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "use-cached requires source", path: ["use-cached"] });
  }
});

export const rawConfigSchema = z.object({
  version: z.literal(1),
  defaults: z.object({ timezone: z.string().optional(), timeout: z.string().optional() }).optional(),
  jobs: z.record(rawJobSchema).refine((jobs) => Object.keys(jobs).length > 0, "must contain at least one job"),
});
