import type { Csm } from '../agent/schemas/csm.js';

export interface ProjectOptions {
  /**
   * Restricts the projection to a single element where the CSM holds several
   * of a kind — one flow out of many for a sequence diagram, one state machine
   * for a state diagram. Null means "pick the most significant one".
   */
  focusId?: string | null;
}

/** A pure CSM slice → PlantUML source transform. Total: never throws on a valid CSM. */
export type Projector = (csm: Csm, options?: ProjectOptions) => string;
