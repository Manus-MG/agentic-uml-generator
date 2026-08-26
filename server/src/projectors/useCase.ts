import type { Csm } from '../agent/schemas/csm.js';
import { alias, emptyDiagram, esc, indent, truncate, wrap } from './lib.js';

export function projectUseCase(csm: Csm): string {
  if (csm.useCases.length === 0) {
    return emptyDiagram(
      'Use Case Diagram',
      'The model defines no use cases. Describe what users need to accomplish to generate one.',
    );
  }

  const body: string[] = [];

  for (const actor of csm.actors) {
    body.push(`actor "${esc(truncate(actor.name, 34))}" as ${alias(actor.id)}`);
  }
  body.push('');

  body.push(`rectangle "${esc(truncate(csm.meta.name || 'System', 40))}" {`);
  body.push(
    ...indent(csm.useCases.map((uc) => `usecase "${esc(truncate(uc.name, 44))}" as ${alias(uc.id)}`)),
  );
  body.push('}');
  body.push('');

  for (const useCase of csm.useCases) {
    for (const actorId of useCase.actorIds) {
      body.push(`${alias(actorId)} --> ${alias(useCase.id)}`);
    }
  }

  for (const useCase of csm.useCases) {
    for (const included of useCase.includes) {
      body.push(`${alias(useCase.id)} ..> ${alias(included)} : <<include>>`);
    }
    // `A extends B` means A is the extension, so the dependency points at the
    // base use case, not away from it.
    for (const base of useCase.extends) {
      body.push(`${alias(useCase.id)} ..> ${alias(base)} : <<extend>>`);
    }
  }

  return wrap(body, {
    title: `${csm.meta.name || 'System'} — Use Cases`,
    directives: ['left to right direction'],
  });
}
