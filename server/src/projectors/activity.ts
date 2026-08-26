import type { Csm, CsmProcess } from '../agent/schemas/csm.js';
import { emptyDiagram, esc, escInline, indent, truncate, wrap } from './lib.js';
import type { ProjectOptions } from './types.js';

type Activity = CsmProcess['activities'][number];

/**
 * Activity diagram projection.
 *
 * This is the only structurally hard projector. The CSM stores a process as an
 * arbitrary directed graph, but PlantUML's activity syntax is *nested* —
 * `if/else/endif` and `fork/end fork` must balance. So we reduce the graph to a
 * structured form rather than transliterating it edge by edge:
 *
 *   - a decision becomes `if/elseif/else/endif`, with the branches walked up to
 *     their convergence point (the first node every branch can reach)
 *   - a fork becomes `fork/fork again/end fork`, closed at its matching join
 *   - a back edge — the graph is cyclic, which the nested syntax cannot express
 *     — is rendered as an explicit "back to X" marker and the branch stopped
 *
 * The last rule is a deliberate, visible approximation: an honest marker beats
 * either a silently dropped edge or an unbalanced block that fails to parse.
 */
export function projectActivity(csm: Csm, options: ProjectOptions = {}): string {
  const process = pickProcess(csm, options.focusId ?? null);
  if (!process) {
    return emptyDiagram(
      'Activity Diagram',
      'The model describes no processes. Describe a workflow end to end to generate one.',
    );
  }

  const byId = new Map(process.activities.map((a) => [a.id, a]));
  const laneName = new Map(process.lanes.map((l) => [l.id, l.name]));
  const successors = new Map<string, { toId: string; guard: string | null }[]>();
  for (const t of process.transitions) {
    const list = successors.get(t.fromId);
    if (list) list.push({ toId: t.toId, guard: t.guard });
    else successors.set(t.fromId, [{ toId: t.toId, guard: t.guard }]);
  }

  const start = process.activities.find((a) => a.type === 'start');
  if (!start) {
    return emptyDiagram('Activity Diagram', `Process "${process.name}" has no start node.`);
  }

  const out: string[] = [];
  let currentLane: string | null = null;

  const lane = (id: string) => `|${escInline(truncate(laneName.get(id) ?? id, 30))}|`;

  const switchLane = (activity: Activity, sink: string[]) => {
    if (activity.laneId && activity.laneId !== currentLane) {
      currentLane = activity.laneId;
      sink.push(lane(activity.laneId));
    }
  };

  /**
   * The lane the diagram opens in.
   *
   * PlantUML rejects a swimlane switch as the first statement after `start`, so
   * a laned process must open a lane before it. The start node usually carries
   * no lane of its own — it is a pseudostate, not work someone does — so the
   * lane of the first real activity downstream is the one to open with.
   */
  const openingLane = (): string | null => {
    if (process.lanes.length === 0) return null;
    if (start.laneId) return start.laneId;

    const seen = new Set<string>([start.id]);
    const queue = (successors.get(start.id) ?? []).map((edge) => edge.toId);
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const found = byId.get(id);
      if (found?.laneId) return found.laneId;
      for (const edge of successors.get(id) ?? []) queue.push(edge.toId);
    }
    return process.lanes[0]!.id;
  };

  /** Every node reachable from `id`, used to find where branches converge. */
  const reachableCache = new Map<string, Set<string>>();
  const reachable = (id: string): Set<string> => {
    const cached = reachableCache.get(id);
    if (cached) return cached;
    const seen = new Set<string>();
    const queue = [id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of successors.get(current) ?? []) {
        if (!seen.has(edge.toId)) {
          seen.add(edge.toId);
          queue.push(edge.toId);
        }
      }
    }
    reachableCache.set(id, seen);
    return seen;
  };

  /**
   * The first node, in breadth-first order from `origin`, that every branch can
   * reach. That is where an `if` can safely close.
   */
  const convergence = (origin: string, branchStarts: string[]): string | null => {
    if (branchStarts.length === 0) return null;
    const sets = branchStarts.map((b) => {
      const s = reachable(b);
      return new Set([b, ...s]);
    });
    const queue = [origin];
    const seen = new Set<string>([origin]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current !== origin && sets.every((s) => s.has(current))) return current;
      for (const edge of successors.get(current) ?? []) {
        if (!seen.has(edge.toId)) {
          seen.add(edge.toId);
          queue.push(edge.toId);
        }
      }
    }
    return null;
  };

  /**
   * Walks the graph from `id` until `stopAt` (exclusive) or a terminal node.
   * Returns true when this branch ended in a `stop`, so the caller knows not to
   * append another one — an unconditional trailing `stop` renders as an orphan
   * end-node floating beside the diagram.
   */
  const walk = (id: string | null, stopAt: string | null, path: Set<string>, sink: string[]): boolean => {
    let cursor = id;
    let guard = 0;

    while (cursor !== null && cursor !== stopAt && guard++ < 512) {
      if (path.has(cursor)) {
        const node = byId.get(cursor);
        sink.push(`:↺ back to "${esc(truncate(node?.name ?? cursor, 40))}";`);
        sink.push('stop');
        return true;
      }

      const activity = byId.get(cursor);
      if (!activity) return false;

      path.add(cursor);
      const edges = successors.get(cursor) ?? [];

      switch (activity.type) {
        case 'start': {
          const opening = openingLane();
          if (opening) {
            currentLane = opening;
            sink.push(lane(opening));
          }
          sink.push('start');
          cursor = edges[0]?.toId ?? null;
          break;
        }

        case 'end': {
          sink.push('stop');
          return true;
        }

        case 'action': {
          switchLane(activity, sink);
          sink.push(`:${escInline(truncate(activity.name, 70))};`);
          cursor = edges[0]?.toId ?? null;
          break;
        }

        case 'decision': {
          switchLane(activity, sink);
          if (edges.length < 2) {
            sink.push(`:${escInline(truncate(activity.name, 70))};`);
            cursor = edges[0]?.toId ?? null;
            break;
          }
          const join = convergence(cursor, edges.map((e) => e.toId));
          const [first, ...rest] = edges;
          let allBranchesTerminated = true;

          sink.push(`if (${escInline(truncate(activity.name, 50))}) then (${label(first!.guard, 'yes')})`);
          const firstBranch: string[] = [];
          allBranchesTerminated = walk(first!.toId, join, new Set(path), firstBranch) && allBranchesTerminated;
          sink.push(...indent(firstBranch));

          const last = rest.pop()!;
          for (const edge of rest) {
            sink.push(`elseif (${escInline(truncate(activity.name, 50))}) then (${label(edge.guard, 'else')})`);
            const branch: string[] = [];
            allBranchesTerminated = walk(edge.toId, join, new Set(path), branch) && allBranchesTerminated;
            sink.push(...indent(branch));
          }
          sink.push(`else (${label(last.guard, 'no')})`);
          const lastBranch: string[] = [];
          allBranchesTerminated = walk(last.toId, join, new Set(path), lastBranch) && allBranchesTerminated;
          sink.push(...indent(lastBranch));
          sink.push('endif');

          // With no convergence point the branches never rejoin, so this `if`
          // is the end of the road for every path through it.
          if (join === null) return allBranchesTerminated;
          cursor = join;
          break;
        }

        case 'fork': {
          const join = findJoin(cursor, edges.map((e) => e.toId), byId, reachable);
          sink.push('fork');
          edges.forEach((edge, index) => {
            if (index > 0) sink.push('fork again');
            const branch: string[] = [];
            walk(edge.toId, join, new Set(path), branch);
            sink.push(...indent(branch));
          });
          sink.push('end fork');
          // Step past the join itself; its own successor continues the flow.
          cursor = join ? (successors.get(join)?.[0]?.toId ?? null) : null;
          break;
        }

        case 'join': {
          cursor = edges[0]?.toId ?? null;
          break;
        }
      }
    }

    return false;
  };

  const terminated = walk(start.id, null, new Set(), out);
  if (!terminated) out.push('stop');

  return wrap(out, {
    title: process.name,
    directives: ['skinparam ActivityBackgroundColor #F4F7FB', 'skinparam ActivityBorderColor #33475B'],
  });
}

function label(guard: string | null, fallback: string): string {
  return guard ? escInline(truncate(guard, 24)) : fallback;
}

/** The first `join` node every parallel branch reaches. */
function findJoin(
  origin: string,
  branchStarts: string[],
  byId: Map<string, Activity>,
  reachable: (id: string) => Set<string>,
): string | null {
  const sets = branchStarts.map((b) => new Set([b, ...reachable(b)]));
  const candidates = [...reachable(origin)].filter((id) => byId.get(id)?.type === 'join');
  return candidates.find((id) => sets.every((s) => s.has(id))) ?? null;
}

function pickProcess(csm: Csm, focusId: string | null): CsmProcess | undefined {
  if (focusId) {
    const match = csm.processes.find((p) => p.id === focusId);
    if (match) return match;
  }
  return [...csm.processes].sort((a, b) => b.activities.length - a.activities.length)[0];
}
