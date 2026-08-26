import { z } from 'zod';

/**
 * Output of the requirement-understanding node.
 *
 * This is deliberately a separate, smaller pass than CSM construction. Asking
 * one call to both interpret an ambiguous prose brief *and* emit a fully
 * cross-referenced system model produces worse models than doing it in two
 * steps, because the first step is where ambiguity should be surfaced and
 * recorded rather than silently resolved.
 *
 * Strict-mode rules apply: no `.optional()`, use `.nullable()`.
 */
export const RequirementModelSchema = z.object({
  systemName: z.string().describe('Short name for the system being described'),
  summary: z.string().describe('One paragraph restating what the user wants built'),
  domain: z.string(),

  goals: z.array(z.string()).describe('Business outcomes the system must achieve'),
  inScope: z.array(z.string()),
  outOfScope: z.array(z.string()).describe('Explicitly excluded, or reasonably inferred as excluded'),

  actors: z
    .array(
      z.object({
        name: z.string(),
        kind: z.enum(['human', 'external_system', 'scheduler']),
        responsibility: z.string(),
      }),
    )
    .describe('Everyone and everything that interacts with the system'),

  externalSystems: z
    .array(
      z.object({
        name: z.string(),
        purpose: z.string(),
        integrationStyle: z.string().describe('e.g. REST poll, webhook, file drop, scraping'),
      }),
    )
    .describe('Third-party systems the solution must talk to'),

  functionalRequirements: z
    .array(
      z.object({
        id: z.string().describe('Short slug, e.g. "fr-parse-circular"'),
        statement: z.string(),
        priority: z.enum(['must', 'should', 'could']),
      }),
    )
    .describe('What the system must do, one atomic capability per entry'),

  nonFunctionalRequirements: z.array(
    z.object({
      category: z.string().describe('e.g. security, performance, auditability, compliance'),
      statement: z.string(),
    }),
  ),

  dataObjects: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        sensitive: z.boolean().describe('true if it carries PII or regulated data'),
      }),
    )
    .describe('The nouns the system stores or moves'),

  keyProcesses: z
    .array(
      z.object({
        name: z.string(),
        trigger: z.string(),
        outline: z.array(z.string()).describe('Ordered high-level steps'),
      }),
    )
    .describe('The main end-to-end workflows'),

  assumptions: z
    .array(z.string())
    .describe('Gaps you filled in yourself. Be explicit — these are shown to the user.'),
  ambiguities: z
    .array(
      z.object({
        question: z.string(),
        assumedAnswer: z.string().describe('What you assumed so the work could proceed'),
      }),
    )
    .describe('Things a human should confirm. Never block on these; assume and record.'),

  confidence: z.number().min(0).max(1).describe('How well the prompt determined the design'),
});

export type RequirementModel = z.infer<typeof RequirementModelSchema>;
