import { z } from "zod";

const clockPattern = /^\d{2}:\d{2}$/;

export const workflowSuiteModulesSchema = z
  .object({
    notifier: z.boolean().optional(),
    repoLocal: z.boolean().optional(),
    todoEnforcer: z.boolean().optional(),
  })
  .strict();

export const todoEnforcerGuardsSchema = z
  .object({
    abortWindow: z.boolean().optional(),
    backgroundTasks: z.boolean().optional(),
    skippedAgents: z.boolean().optional(),
    stopState: z.boolean().optional(),
  })
  .strict();

export const todoEnforcerSerializableOptionsSchema = z
  .object({
    abortWindowMs: z.number().int().nonnegative().optional(),
    countdownGraceMs: z.number().int().nonnegative().optional(),
    countdownMs: z.number().int().nonnegative().optional(),
    continuationCooldownMs: z.number().int().nonnegative().optional(),
    debug: z.boolean().optional(),
    enabled: z.boolean().optional(),
    failureResetWindowMs: z.number().int().nonnegative().optional(),
    guards: todoEnforcerGuardsSchema.optional(),
    maxConsecutiveFailures: z.number().int().positive().optional(),
    prompt: z.string().optional(),
    sessionPruneIntervalMs: z.number().int().nonnegative().optional(),
    sessionTtlMs: z.number().int().nonnegative().optional(),
    skipAgents: z.array(z.string()).optional(),
    stopCommand: z.string().optional(),
  })
  .strict();

export const todoEnforcerOptionsSchema = todoEnforcerSerializableOptionsSchema
  .extend({
    hasRunningBackgroundTasks: z
      .function()
      .args(z.string())
      .returns(z.boolean())
      .optional(),
    now: z.function().args().returns(z.number()).optional(),
  })
  .strict();

export const workflowNotifierQuietHoursSchema = z
  .object({
    enabled: z.boolean().optional(),
    end: z.string().regex(clockPattern).optional(),
    start: z.string().regex(clockPattern).optional(),
  })
  .strict();

export const workflowNotifierEventsSchema = z
  .object({
    enforcerFailure: z.boolean().optional(),
    error: z.boolean().optional(),
    paused: z.boolean().optional(),
    permission: z.boolean().optional(),
    question: z.boolean().optional(),
    terminalReady: z.boolean().optional(),
  })
  .strict();

export const workflowNotifierCommandSchema = z
  .object({
    args: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
    path: z.string().optional(),
  })
  .strict();

export const workflowNotifierSerializableOptionsSchema = z
  .object({
    command: workflowNotifierCommandSchema.optional(),
    cooldownMs: z.number().int().nonnegative().optional(),
    enabled: z.boolean().optional(),
    events: workflowNotifierEventsSchema.optional(),
    focusCommand: workflowNotifierCommandSchema.optional(),
    focusTitleHints: z.array(z.string()).optional(),
    maxWaitMs: z.number().int().nonnegative().optional(),
    pollMs: z.number().int().nonnegative().optional(),
    quietHours: workflowNotifierQuietHoursSchema.optional(),
    settleMs: z.number().int().nonnegative().optional(),
    showToastFallback: z.boolean().optional(),
    suppressWhenFocused: z.boolean().optional(),
  })
  .strict();

export const workflowNotifierOptionsSchema =
  workflowNotifierSerializableOptionsSchema
    .extend({
      now: z.function().args().returns(z.number()).optional(),
    })
    .strict();

export const workflowSuiteOptionsSchema = z
  .object({
    modules: workflowSuiteModulesSchema.optional(),
    notifier: workflowNotifierOptionsSchema.optional(),
    todoEnforcer: todoEnforcerOptionsSchema.optional(),
  })
  .strict();

export const workflowSuiteFileOptionsSchema = z
  .object({
    $schema: z.string().optional(),
    modules: workflowSuiteModulesSchema.optional(),
    notifier: workflowNotifierSerializableOptionsSchema.optional(),
    todoEnforcer: todoEnforcerSerializableOptionsSchema.optional(),
  })
  .strict();

export type WorkflowSuiteModulesOptions = z.infer<
  typeof workflowSuiteModulesSchema
>;
export type TodoEnforcerOptions = z.infer<typeof todoEnforcerOptionsSchema>;
export type WorkflowNotifierOptions = z.infer<
  typeof workflowNotifierOptionsSchema
>;
export type WorkflowSuiteOptions = z.infer<typeof workflowSuiteOptionsSchema>;
export type WorkflowSuiteFileOptions = z.infer<
  typeof workflowSuiteFileOptionsSchema
>;
