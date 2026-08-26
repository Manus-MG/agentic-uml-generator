/**
 * The client's view of the backend contract.
 *
 * Every shape here mirrors what `server/src` actually returns — the diagram
 * payload comes from `agent/pipeline.ts`, the run events from the SSE stream in
 * `controllers/generateController.ts`.
 */

/* ---------------------------------------------------------------- catalogue */

export type DiagramCategory = 'Structure' | 'Behavior';
export type DiagramSubcategory = 'Interaction';

export interface UMLModel {
  id: string;
  name: string;
  category: DiagramCategory;
  subcategory?: DiagramSubcategory;
  summary: string;
  description: string;
  useCase: string;
}

export interface CategoryGroup {
  title: string;
  count: number;
  items: UMLModel[];
}

export interface DiagramTypesResponse {
  success: boolean;
  total: number;
  data: UMLModel[];
  categories: {
    structure: CategoryGroup;
    behavior: CategoryGroup;
    interaction: CategoryGroup;
  };
}

/* ------------------------------------------------------------------- health */

/** Note: this endpoint has no `success` field, unlike every other one. */
export interface BackendHealthResponse {
  status: 'ok' | 'degraded' | string;
  message: string;
  timestamp: string;
  checks?: {
    mongo: string;
    plantuml: string;
    groq: string;
    model?: string;
  };
}

/* ----------------------------------------------------------------- diagrams */

/** A PlantUML syntax error, as the renderer reported it. */
export interface RenderError {
  message: string;
  line: number | null;
}

export interface IntegrityIssue {
  path: string;
  code: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface Integrity {
  ok: boolean;
  errors: IntegrityIssue[];
  warnings: IntegrityIssue[];
}

export interface RunUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  llmCalls: number;
}

export interface DiagramPayload {
  type: string;
  /** Always equal to `type` — use the catalogue for a display name. */
  name: string;
  /**
   * 'projected' means the source exists but has not been through the renderer,
   * so `valid` is null: not yet checked, as opposed to checked and wrong.
   */
  status: 'projected' | 'rendered';
  source: string;
  svg: string | null;
  pngUrl: string | null;
  valid: boolean | null;
  errors: RenderError[];
  repairAttempts: number;
  /** A revision left this diagram's slices alone and reused the last render. */
  carriedForward: boolean;
  diagramId: string | null;
}

/* --------------------------------------------------------------- run events */

export interface PhaseEvent {
  type: 'phase';
  phase: string;
  detail: string | null;
}

export interface DiagramEvent {
  type: 'diagram';
  diagram: DiagramPayload;
}

export interface DoneEvent {
  type: 'done';
  sessionId: string;
  version: number;
  mode: 'generate' | 'revise';
  diagramTypes: string[];
  /** Requested names the backend could not resolve. The run continued without them. */
  unknownTypes: string[];
  /** Which parts of the canonical model this turn actually changed. */
  changedSlices: string[];
  rationale: string | null;
  integrity: Integrity;
  usage: RunUsage;
  ms: number;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  kind: string | null;
}

export type RunEvent = PhaseEvent | DiagramEvent | DoneEvent | ErrorEvent;

/** The non-streaming fallback: the `done` event, flattened, plus the diagrams. */
export type GenerateResponse = DoneEvent & {
  success: boolean;
  diagrams: DiagramPayload[];
};

export interface SwitchViewResponse {
  success: boolean;
  sessionId: string;
  version: number;
  diagram: DiagramPayload;
  /** 0 when the stored model already covered this view. */
  llmCalls: number;
  usage: RunUsage;
  ms: number;
}

export interface ListDiagramsResponse {
  success: boolean;
  sessionId: string;
  version: number;
  total: number;
  diagrams: DiagramPayload[];
}

/* -------------------------------------------------------------------- users */

export interface UserProfile {
  userId: string;
  name: string;
  createdAt?: string;
}

export interface UserIdentifyResponse {
  success: boolean;
  isNewUser: boolean;
  user: UserProfile;
  message: string;
}

export interface UserListResponse {
  success: boolean;
  total: number;
  users: UserProfile[];
}

/* ----------------------------------------------------------------- sessions */

export interface SessionSummary {
  sessionId: string;
  userId?: string;
  title: string;
  currentVersion: number;
  diagramTypes: string[];
  turnCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface SessionListResponse {
  success: boolean;
  total: number;
  userId?: string;
  sessions: SessionSummary[];
}

export interface SessionTurn {
  version: number;
  kind: 'generate' | 'revise';
  prompt: string;
  diagramTypes: string[];
  at: string;
  diagrams: { type: string; valid: boolean; carriedForward: boolean }[];
}

export interface SessionResponse {
  success: boolean;
  sessionId: string;
  brief: string;
  diagramTypes: string[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  turns: SessionTurn[];
}

export interface DeleteSessionResponse {
  success: boolean;
  sessionId: string;
  deleted: { thread: number; csmVersions: number; diagrams: number };
  note: string;
}

export interface CanonicalModelResponse {
  success: boolean;
  sessionId: string;
  version: number;
  rationale: string | null;
  integrity: Integrity;
  csm: unknown;
}

/* ----------------------------------------------------------------- feedback */

export type Rating = 'up' | 'down';

export interface FeedbackSubmission {
  sessionId: string;
  diagramId: string;
  rating: Rating;
  comments?: string | null;
}

export interface FeedbackEntry {
  feedbackId: string;
  diagramId: string;
  diagramType: string;
  version: number;
  rating: Rating;
  reward: number;
  comments: string | null;
  at: string;
}

export interface FeedbackListResponse {
  success: boolean;
  sessionId: string;
  total: number;
  feedback: FeedbackEntry[];
}

export interface FeedbackResponse {
  success: boolean;
  feedbackId: string;
  sessionId: string;
  diagramType: string;
  version: number;
  reward: number;
}
