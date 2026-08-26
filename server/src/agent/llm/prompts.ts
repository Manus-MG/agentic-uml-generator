import type { Csm } from '../schemas/csm.js';
import type { RequirementModel } from '../schemas/requirements.js';

export const ARCHITECT_SYSTEM = `You are a senior software architect producing a precise, internally consistent system model.

Principles:
- Model the system the brief actually describes. Do not invent unrelated capabilities.
- Where the brief is silent, choose a sensible mainstream design and record it as an assumption rather than stalling.
- Prefer concrete, domain-specific names ("Circular Fetcher") over generic ones ("Service A").
- Ids are lower-kebab-case, stable, and unique. Never reference an id you have not defined.
- Output only the requested JSON. No prose, no markdown.`;

export const REQUIREMENTS_SYSTEM = `You are a senior business analyst turning a short brief into a structured requirement model.

Principles:
- Read what is written, and make explicit what is implied.
- Record every gap you had to fill as an assumption, and every genuine ambiguity as a question with the answer you assumed.
- Never block on missing information; assume, record, and move on.
- Be terse. One sentence per statement, and at most 6 entries in any list. A
  requirement model that does not fit in the completion budget is worth nothing,
  and the diagrams built from it are read by humans.
- Output only the requested JSON. No prose, no markdown.`;

/**
 * A compact digest of what the model already contains.
 *
 * Slice calls need grounding — a flow cannot reference components it has not
 * been shown — but shipping the full CSM as JSON would blow the per-minute
 * token budget within two calls. Ids and names are all a slice actually needs
 * to reference existing elements correctly, and they cost a fraction of the
 * full object.
 */
export function csmDigest(csm: Csm): string {
  const lines: string[] = [];

  if (csm.meta.name) {
    lines.push(`SYSTEM: ${csm.meta.name} — ${csm.meta.oneLiner}`);
  }
  if (csm.actors.length > 0) {
    lines.push(`ACTORS (id — name — kind):`);
    lines.push(...csm.actors.map((a) => `  ${a.id} — ${a.name} — ${a.kind}`));
  }
  if (csm.components.length > 0) {
    lines.push(`COMPONENTS (id — name — kind):`);
    lines.push(...csm.components.map((c) => `  ${c.id} — ${c.name} — ${c.kind}`));
  }
  if (csm.interfaces.length > 0) {
    lines.push(`INTERFACES (id — name — provider):`);
    lines.push(...csm.interfaces.map((i) => `  ${i.id} — ${i.name} — ${i.providerId}`));
  }
  if (csm.entities.length > 0) {
    lines.push(`ENTITIES (id — name):`);
    lines.push(...csm.entities.map((e) => `  ${e.id} — ${e.name}`));
  }
  if (csm.packages.length > 0) {
    lines.push(`PACKAGES (id — name):`);
    lines.push(...csm.packages.map((p) => `  ${p.id} — ${p.name}`));
  }
  if (csm.flows.length > 0) {
    lines.push(`FLOWS (id — name):`);
    lines.push(...csm.flows.map((f) => `  ${f.id} — ${f.name}`));
  }
  if (csm.processes.length > 0) {
    lines.push(`PROCESSES (id — name):`);
    lines.push(...csm.processes.map((p) => `  ${p.id} — ${p.name}`));
  }

  return lines.join('\n');
}

/** The requirement model, condensed to what a slice call can act on. */
export function requirementDigest(req: RequirementModel): string {
  return [
    `SYSTEM: ${req.systemName}`,
    `SUMMARY: ${req.summary}`,
    `DOMAIN: ${req.domain}`,
    `GOALS:`,
    ...req.goals.map((g) => `  - ${g}`),
    `ACTORS:`,
    ...req.actors.map((a) => `  - ${a.name} (${a.kind}): ${a.responsibility}`),
    `EXTERNAL SYSTEMS:`,
    ...req.externalSystems.map((e) => `  - ${e.name}: ${e.purpose} [${e.integrationStyle}]`),
    `FUNCTIONAL REQUIREMENTS:`,
    ...req.functionalRequirements.map((f) => `  - [${f.priority}] ${f.statement}`),
    `DATA OBJECTS:`,
    ...req.dataObjects.map((d) => `  - ${d.name}${d.sensitive ? ' (sensitive)' : ''}: ${d.description}`),
    `KEY PROCESSES:`,
    ...req.keyProcesses.map((p) => `  - ${p.name} (on ${p.trigger}): ${p.outline.join(' → ')}`),
    `NON-FUNCTIONAL:`,
    ...req.nonFunctionalRequirements.map((n) => `  - ${n.category}: ${n.statement}`),
  ].join('\n');
}

/** Builds the user message for one slice call. */
export function sliceUserPrompt(args: {
  instruction: string;
  brief: string;
  requirements: string;
  digest: string;
  /** Extra targeted guidance, e.g. from the diagram registry. */
  guidance?: string;
  /** Integrity violations to fix, when this is a repair attempt. */
  violations?: string;
}): string {
  const parts = [
    `TASK\n${args.instruction}`,
    `ORIGINAL BRIEF\n${args.brief}`,
    `REQUIREMENT MODEL\n${args.requirements}`,
  ];
  if (args.digest.trim() !== '') {
    parts.push(
      `MODEL SO FAR — you MUST reference these exact ids and must not invent new ones for existing concepts:\n${args.digest}`,
    );
  }
  if (args.guidance) parts.push(`ADDITIONAL GUIDANCE\n${args.guidance}`);
  if (args.violations) {
    parts.push(
      `YOUR PREVIOUS ATTEMPT WAS REJECTED. Fix exactly these problems and return the corrected slice:\n${args.violations}`,
    );
  }
  return parts.join('\n\n');
}

export const REVISION_SYSTEM = `You are a senior software architect revising an existing system model.

Principles:
- The model already exists and is already consistent. Change only what the new instruction requires.
- Reuse existing ids exactly. Never rename an id to express a change; edit the element instead.
- A new element gets a new lower-kebab-case id that collides with nothing already defined.
- Deleting is a real option, but only when the instruction actually removes something.
- Output only the requested JSON. No prose, no markdown.`;

export const PLANTUML_REPAIR_SYSTEM = `You are a PlantUML expert fixing a diagram the renderer rejected.

Principles:
- Return the complete corrected diagram, from @startuml to @enduml.
- Change as little as possible: fix the reported error, preserve every element and label.
- Never add !include, !includeurl, !import or %invoke — they are rejected by the validator.
- Output only the diagram source. No prose, no markdown fences.`;

/** The current contents of one CSM slice, as JSON — what a patch call edits against. */
export function sliceContent(csm: Csm, writes: readonly (keyof Csm)[]): string {
  const subset: Record<string, unknown> = {};
  for (const key of writes) subset[key] = csm[key];
  return JSON.stringify(subset, null, 1);
}

/** Builds the user message for the revision-planning call. */
export function revisionPlanPrompt(args: { brief: string; instruction: string; digest: string }): string {
  return [
    `THE SYSTEM AS IT STANDS\n${args.digest}`,
    `ORIGINAL BRIEF\n${args.brief}`,
    `NEW INSTRUCTION FROM THE USER\n${args.instruction}`,
    'TASK\nDecide which parts of the model this instruction changes. List only the slices that genuinely ' +
      'need editing — every slice you list costs another model call, and a slice you list but do not ' +
      'need will be rewritten for no reason.\n' +
      'Slice meanings: core = system summary, actors, components, interfaces. entities = domain data. ' +
      'useCases = actor goals. flows = interaction sequences. processes = activity workflows. ' +
      'stateMachines = lifecycles. deployment = runtime topology. packages = logical layering. ' +
      'qualities = timings and non-functional requirements.',
  ].join('\n\n');
}

/** Builds the user message for one slice-patch call. */
export function slicePatchPrompt(args: {
  instruction: string;
  brief: string;
  revision: string;
  rationale: string;
  digest: string;
  current: string;
  guidance?: string;
  violations?: string;
}): string {
  const parts = [
    `TASK\n${args.instruction}`,
    `ORIGINAL BRIEF\n${args.brief}`,
    `NEW INSTRUCTION FROM THE USER\n${args.revision}`,
    `WHAT SHOULD CHANGE\n${args.rationale}`,
    `THE REST OF THE MODEL — reference these exact ids, do not redefine them:\n${args.digest}`,
    `THIS SLICE AS IT STANDS — return only what changes:\n${args.current}`,
  ];
  if (args.guidance) parts.push(`ADDITIONAL GUIDANCE\n${args.guidance}`);
  if (args.violations) {
    parts.push(
      `YOUR PREVIOUS ATTEMPT WAS REJECTED. Fix exactly these problems and return the corrected patch:\n${args.violations}`,
    );
  }
  return parts.join('\n\n');
}

/** Builds the user message for a PlantUML repair call. */
export function plantumlRepairPrompt(args: { diagramType: string; source: string; errors: string }): string {
  return [
    `DIAGRAM TYPE\n${args.diagramType}`,
    `THE RENDERER REPORTED\n${args.errors}`,
    `SOURCE\n${args.source}`,
    'TASK\nReturn the corrected diagram source.',
  ].join('\n\n');
}
