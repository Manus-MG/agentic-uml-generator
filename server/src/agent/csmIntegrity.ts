import type { Csm } from './schemas/csm.js';

export type IntegritySeverity = 'error' | 'warning';

export interface IntegrityIssue {
  path: string;
  code: string;
  severity: IntegritySeverity;
  message: string;
}

export interface IntegrityReport {
  ok: boolean;
  errors: IntegrityIssue[];
  warnings: IntegrityIssue[];
}

/** The initial/terminal pseudostate marker, borrowed from PlantUML's own syntax. */
export const PSEUDOSTATE = '[*]';

/**
 * Deterministic referential-integrity validation of a CSM.
 *
 * Zod proves the *shape* is right. It cannot prove that `flows[0].steps[2].toId`
 * names a component that exists, that a fork has a matching join, or that a
 * state machine can actually reach a terminal state. Those are exactly the
 * mistakes an LLM makes when assembling a large cross-referenced object, and
 * they are also exactly what would make a projector emit nonsense or throw.
 *
 * So this runs before any projection, and its issues are fed verbatim back to
 * the model for repair. Errors block; warnings are recorded and shown.
 */
export function validateCsm(csm: Csm): IntegrityReport {
  const issues: IntegrityIssue[] = [];

  const err = (path: string, code: string, message: string) =>
    issues.push({ path, code, severity: 'error', message });
  const warn = (path: string, code: string, message: string) =>
    issues.push({ path, code, severity: 'warning', message });

  // ---- id sets -------------------------------------------------------------
  const actorIds = collectIds(csm.actors, 'actors', err);
  const componentIds = collectIds(csm.components, 'components', err);
  const interfaceIds = collectIds(csm.interfaces, 'interfaces', err);
  const entityIds = collectIds(csm.entities, 'entities', err);
  const useCaseIds = collectIds(csm.useCases, 'useCases', err);
  const flowIds = collectIds(csm.flows, 'flows', err);
  const processIds = collectIds(csm.processes, 'processes', err);
  const stateMachineIds = collectIds(csm.stateMachines, 'stateMachines', err);
  const packageIds = collectIds(csm.packages, 'packages', err);
  const nodeIds = collectIds(csm.deployment.nodes, 'deployment.nodes', err);
  const artifactIds = collectIds(csm.deployment.artifacts, 'deployment.artifacts', err);

  // A lifeline in a sequence diagram may be either an actor or a component.
  const participantIds = new Set([...actorIds, ...componentIds]);

  // Actors and components share a namespace in flows; a collision makes a
  // participant reference genuinely ambiguous rather than merely ugly.
  for (const id of actorIds) {
    if (componentIds.has(id)) {
      err('actors', 'id-collision', `id "${id}" is used by both an actor and a component`);
    }
  }

  // ---- components ----------------------------------------------------------
  csm.components.forEach((component, i) => {
    const at = `components[${i}]`;
    if (component.packageId !== null && !packageIds.has(component.packageId)) {
      err(`${at}.packageId`, 'dangling-ref', `"${component.packageId}" is not a known package id`);
    }
    for (const ifaceId of component.provides) {
      if (!interfaceIds.has(ifaceId)) {
        err(`${at}.provides`, 'dangling-ref', `"${ifaceId}" is not a known interface id`);
      }
    }
    for (const ifaceId of component.requires) {
      if (!interfaceIds.has(ifaceId)) {
        err(`${at}.requires`, 'dangling-ref', `"${ifaceId}" is not a known interface id`);
      }
    }
    if (component.responsibilities.length === 0) {
      warn(`${at}.responsibilities`, 'empty', `component "${component.name}" has no responsibilities`);
    }
  });

  // ---- interfaces ----------------------------------------------------------
  csm.interfaces.forEach((iface, i) => {
    const at = `interfaces[${i}]`;
    if (!componentIds.has(iface.providerId)) {
      err(`${at}.providerId`, 'dangling-ref', `"${iface.providerId}" is not a known component id`);
      return;
    }
    const provider = csm.components.find((c) => c.id === iface.providerId)!;
    if (!provider.provides.includes(iface.id)) {
      err(
        `${at}.providerId`,
        'inconsistent-ref',
        `interface "${iface.id}" names "${provider.id}" as provider, but that component does not list it in provides[]`,
      );
    }
  });

  // ---- entities ------------------------------------------------------------
  csm.entities.forEach((entity, i) => {
    entity.relations.forEach((rel, j) => {
      if (!entityIds.has(rel.toId)) {
        err(`entities[${i}].relations[${j}].toId`, 'dangling-ref', `"${rel.toId}" is not a known entity id`);
      }
    });
    const names = new Set<string>();
    for (const attr of entity.attributes) {
      if (names.has(attr.name)) {
        warn(`entities[${i}].attributes`, 'duplicate', `duplicate attribute "${attr.name}"`);
      }
      names.add(attr.name);
    }
  });

  // ---- use cases -----------------------------------------------------------
  csm.useCases.forEach((uc, i) => {
    const at = `useCases[${i}]`;
    for (const actorId of uc.actorIds) {
      if (!actorIds.has(actorId)) {
        err(`${at}.actorIds`, 'dangling-ref', `"${actorId}" is not a known actor id`);
      }
    }
    for (const [field, list] of [['includes', uc.includes], ['extends', uc.extends]] as const) {
      for (const ref of list) {
        if (!useCaseIds.has(ref)) {
          err(`${at}.${field}`, 'dangling-ref', `"${ref}" is not a known use case id`);
        } else if (ref === uc.id) {
          err(`${at}.${field}`, 'self-reference', `use case "${uc.id}" ${field} itself`);
        }
      }
    }
  });

  // ---- flows ---------------------------------------------------------------
  csm.flows.forEach((flow, i) => {
    const at = `flows[${i}]`;
    const declared = new Set(flow.participants);

    for (const p of flow.participants) {
      if (!participantIds.has(p)) {
        err(`${at}.participants`, 'dangling-ref', `"${p}" is neither an actor nor a component id`);
      }
    }
    if (flow.steps.length === 0) {
      err(`${at}.steps`, 'empty', `flow "${flow.name}" has no steps`);
    }

    flow.steps.forEach((step, j) => {
      for (const [field, id] of [['fromId', step.fromId], ['toId', step.toId]] as const) {
        if (!participantIds.has(id)) {
          err(`${at}.steps[${j}].${field}`, 'dangling-ref', `"${id}" is neither an actor nor a component id`);
        } else if (!declared.has(id)) {
          err(
            `${at}.steps[${j}].${field}`,
            'undeclared-participant',
            `"${id}" is used in a step but missing from participants[]`,
          );
        }
      }
      if (step.group === 'alt' && step.condition === null) {
        warn(`${at}.steps[${j}].condition`, 'missing-guard', 'alt fragment without a condition renders an unlabelled branch');
      }
    });

    flow.errorPaths.forEach((ep, j) => {
      if (!participantIds.has(ep.handledBy)) {
        err(`${at}.errorPaths[${j}].handledBy`, 'dangling-ref', `"${ep.handledBy}" is neither an actor nor a component id`);
      }
    });
  });

  // ---- processes (activity diagrams) ---------------------------------------
  csm.processes.forEach((process, i) => {
    const at = `processes[${i}]`;
    const laneIds = collectIds(process.lanes, `${at}.lanes`, err);
    const activityIds = collectIds(process.activities, `${at}.activities`, err);

    for (const activity of process.activities) {
      if (activity.laneId !== null && !laneIds.has(activity.laneId)) {
        err(`${at}.activities`, 'dangling-ref', `activity "${activity.id}" references unknown lane "${activity.laneId}"`);
      }
    }

    const starts = process.activities.filter((a) => a.type === 'start');
    const ends = process.activities.filter((a) => a.type === 'end');
    if (starts.length !== 1) {
      err(`${at}.activities`, 'start-count', `expected exactly one "start" activity, found ${starts.length}`);
    }
    if (ends.length === 0) {
      err(`${at}.activities`, 'no-end', 'process has no "end" activity, so the flow never terminates');
    }

    for (const t of process.transitions) {
      if (!activityIds.has(t.fromId)) {
        err(`${at}.transitions`, 'dangling-ref', `"${t.fromId}" is not a known activity id`);
      }
      if (!activityIds.has(t.toId)) {
        err(`${at}.transitions`, 'dangling-ref', `"${t.toId}" is not a known activity id`);
      }
    }

    const forks = process.activities.filter((a) => a.type === 'fork').length;
    const joins = process.activities.filter((a) => a.type === 'join').length;
    if (forks !== joins) {
      err(`${at}.activities`, 'unbalanced-fork', `${forks} fork(s) but ${joins} join(s); parallel branches must converge`);
    }

    if (starts.length === 1) {
      const reachable = reach(starts[0]!.id, process.transitions);
      for (const activity of process.activities) {
        if (!reachable.has(activity.id)) {
          err(`${at}.activities`, 'unreachable', `activity "${activity.id}" is not reachable from start`);
        }
      }
    }
  });

  // ---- state machines ------------------------------------------------------
  csm.stateMachines.forEach((sm, i) => {
    const at = `stateMachines[${i}]`;
    if (!entityIds.has(sm.subjectId) && !componentIds.has(sm.subjectId)) {
      err(`${at}.subjectId`, 'dangling-ref', `"${sm.subjectId}" is neither an entity nor a component id`);
    }
    const stateIds = collectIds(sm.states, `${at}.states`, err);

    const knows = (id: string) => id === PSEUDOSTATE || stateIds.has(id);
    for (const t of sm.transitions) {
      if (!knows(t.fromId)) {
        err(`${at}.transitions`, 'dangling-ref', `"${t.fromId}" is not a known state id (use "${PSEUDOSTATE}" for the initial pseudostate)`);
      }
      if (!knows(t.toId)) {
        err(`${at}.transitions`, 'dangling-ref', `"${t.toId}" is not a known state id (use "${PSEUDOSTATE}" for a terminal pseudostate)`);
      }
    }

    const initial = sm.transitions.filter((t) => t.fromId === PSEUDOSTATE);
    if (initial.length !== 1) {
      err(`${at}.transitions`, 'start-count', `expected exactly one transition from "${PSEUDOSTATE}", found ${initial.length}`);
    }
    if (!sm.transitions.some((t) => t.toId === PSEUDOSTATE)) {
      warn(`${at}.transitions`, 'no-terminal', 'state machine has no terminal transition; the lifecycle never completes');
    }

    if (initial.length === 1) {
      const reachable = reach(initial[0]!.toId, sm.transitions);
      for (const state of sm.states) {
        if (!reachable.has(state.id)) {
          err(`${at}.states`, 'unreachable', `state "${state.id}" is not reachable from the initial state`);
        }
      }
    }
  });

  // ---- deployment ----------------------------------------------------------
  csm.deployment.artifacts.forEach((artifact, i) => {
    for (const componentId of artifact.componentIds) {
      if (!componentIds.has(componentId)) {
        err(`deployment.artifacts[${i}].componentIds`, 'dangling-ref', `"${componentId}" is not a known component id`);
      }
    }
  });
  csm.deployment.placements.forEach((placement, i) => {
    const at = `deployment.placements[${i}]`;
    if (!artifactIds.has(placement.artifactId)) {
      err(`${at}.artifactId`, 'dangling-ref', `"${placement.artifactId}" is not a known artifact id`);
    }
    if (!nodeIds.has(placement.nodeId)) {
      err(`${at}.nodeId`, 'dangling-ref', `"${placement.nodeId}" is not a known deployment node id`);
    }
  });

  // ---- packages ------------------------------------------------------------
  csm.packages.forEach((pkg, i) => {
    const at = `packages[${i}]`;
    for (const componentId of pkg.containsComponentIds) {
      if (!componentIds.has(componentId)) {
        err(`${at}.containsComponentIds`, 'dangling-ref', `"${componentId}" is not a known component id`);
      }
    }
    for (const dep of pkg.dependsOn) {
      if (!packageIds.has(dep)) {
        err(`${at}.dependsOn`, 'dangling-ref', `"${dep}" is not a known package id`);
      } else if (dep === pkg.id) {
        err(`${at}.dependsOn`, 'self-reference', `package "${pkg.id}" depends on itself`);
      }
    }
  });

  // ---- timings -------------------------------------------------------------
  const anyId = new Set([...participantIds, ...entityIds, ...flowIds, ...processIds, ...stateMachineIds]);
  csm.timings.forEach((timing, i) => {
    if (!anyId.has(timing.subjectId)) {
      err(`timings[${i}].subjectId`, 'dangling-ref', `"${timing.subjectId}" does not name any known element`);
    }
  });

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}

function collectIds(
  items: { id: string }[],
  path: string,
  err: (path: string, code: string, message: string) => void,
): Set<string> {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      err(path, 'duplicate-id', `duplicate id "${item.id}"`);
    }
    seen.add(item.id);
  }
  return seen;
}

/** Forward reachability over a transition list. */
function reach(startId: string, transitions: { fromId: string; toId: string }[]): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const t of transitions) {
    const list = adjacency.get(t.fromId);
    if (list) list.push(t.toId);
    else adjacency.set(t.fromId, [t.toId]);
  }
  const seen = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** Renders a report as the compact text block fed back to the model for repair. */
export function formatIssues(issues: IntegrityIssue[]): string {
  return issues.map((i) => `- [${i.code}] ${i.path}: ${i.message}`).join('\n');
}
