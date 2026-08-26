import type { Csm } from '../agent/schemas/csm.js';
import { alias, emptyDiagram, esc, indent, stereotype, truncate, wrap } from './lib.js';

/** Cloud services render as clouds; everything else as a node. */
function nodeKeyword(kind: string): string {
  return kind === 'cloud-service' ? 'cloud' : 'node';
}

export function projectDeployment(csm: Csm): string {
  const { nodes, artifacts, placements } = csm.deployment;
  if (nodes.length === 0) {
    return emptyDiagram(
      'Deployment Diagram',
      'The model describes no runtime topology. Describe where the system runs (VMs, containers, cloud services) to generate one.',
    );
  }

  const componentName = new Map(csm.components.map((c) => [c.id, c.name]));
  const artifactsByNode = new Map<string, string[]>();
  for (const placement of placements) {
    const list = artifactsByNode.get(placement.nodeId);
    if (list) list.push(placement.artifactId);
    else artifactsByNode.set(placement.nodeId, [placement.artifactId]);
  }

  const body: string[] = [];

  for (const node of nodes) {
    const header = `${nodeKeyword(node.kind)} "${esc(truncate(node.name, 36))}" as ${alias(node.id)} ${stereotype(node.env || node.kind)}`;
    const hosted = artifactsByNode.get(node.id) ?? [];
    if (hosted.length === 0) {
      body.push(header);
      continue;
    }
    body.push(`${header} {`);
    body.push(
      ...indent(
        hosted.map((artifactId) => {
          const artifact = artifacts.find((a) => a.id === artifactId);
          if (!artifact) return `artifact "${esc(artifactId)}" as ${alias(artifactId)}`;
          // Deployed components listed on a second line keeps the artifact→code
          // mapping visible without a second diagram.
          const contents = artifact.componentIds
            .map((id) => componentName.get(id) ?? id)
            .join(', ');
          const label = contents
            ? `${esc(truncate(artifact.name, 30))}\\n(${esc(truncate(contents, 46))})`
            : esc(truncate(artifact.name, 30));
          return `artifact "${label}" as ${alias(artifact.id)}`;
        }),
      ),
    );
    body.push('}');
  }

  const unplaced = artifacts.filter((a) => !placements.some((p) => p.artifactId === a.id));
  if (unplaced.length > 0) {
    body.push('');
    for (const artifact of unplaced) {
      body.push(`artifact "${esc(truncate(artifact.name, 36))}" as ${alias(artifact.id)}`);
    }
  }

  // Node-to-node links inferred from components that talk across placements.
  const nodeOfComponent = new Map<string, string>();
  for (const placement of placements) {
    const artifact = artifacts.find((a) => a.id === placement.artifactId);
    for (const componentId of artifact?.componentIds ?? []) {
      nodeOfComponent.set(componentId, placement.nodeId);
    }
  }
  const links = new Set<string>();
  for (const component of csm.components) {
    const from = nodeOfComponent.get(component.id);
    if (!from) continue;
    for (const requiredId of component.requires) {
      const provider = csm.interfaces.find((i) => i.id === requiredId)?.providerId;
      const to = provider ? nodeOfComponent.get(provider) : undefined;
      if (to && to !== from) links.add(`${alias(from)} --> ${alias(to)}`);
    }
  }
  if (links.size > 0) {
    body.push('');
    body.push(...links);
  }

  return wrap(body, { title: `${csm.meta.name || 'System'} — Deployment` });
}
