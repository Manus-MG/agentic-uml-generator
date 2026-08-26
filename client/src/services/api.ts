import type {
  BackendHealthResponse,
  CanonicalModelResponse,
  DeleteSessionResponse,
  DiagramTypesResponse,
  FeedbackListResponse,
  FeedbackResponse,
  FeedbackSubmission,
  GenerateResponse,
  ListDiagramsResponse,
  RunEvent,
  SessionListResponse,
  SessionResponse,
  SwitchViewResponse,
  UserIdentifyResponse,
  UserListResponse,
  UserProfile,
} from '../types/uml';
import { streamRun } from './sse';

/**
 * Relative on purpose: in dev the Vite proxy forwards `/api` to :5001, and in
 * production the API is served from the same origin.
 */
const API_BASE_URL = '/api';

/** Every JSON endpoint reports failure the same way: `{ success, message }`. */
async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    /* an empty or non-JSON body; the status line is all we have */
  }

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message;
    throw new Error(message ?? `Request failed (${response.status} ${response.statusText})`);
  }
  return data as T;
}

const postInit = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

export const api = {
  /**
   * MongoDB, PlantUML and Groq readiness.
   *
   * Not routed through `json()`: this endpoint answers 503 when a dependency is
   * down, and that body is the answer rather than an error to throw away. It is
   * also the one endpoint with no `success` field.
   */
  async checkHealth(): Promise<BackendHealthResponse> {
    const response = await fetch(`${API_BASE_URL}/health`);
    return (await response.json()) as BackendHealthResponse;
  },

  /** User identification / login by name */
  identifyUser(name: string): Promise<UserIdentifyResponse> {
    return json<UserIdentifyResponse>(`${API_BASE_URL}/users/identify`, postInit({ name }));
  },

  /** Lists known users in the system */
  listUsers(): Promise<UserListResponse> {
    return json<UserListResponse>(`${API_BASE_URL}/users`);
  },

  /** Gets user profile by userId */
  getUser(userId: string): Promise<{ success: boolean; user: UserProfile }> {
    return json<{ success: boolean; user: UserProfile }>(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`);
  },

  /** The 14 diagram types, grouped, with the display names the payloads lack. */
  getDiagramTypes(): Promise<DiagramTypesResponse> {
    return json<DiagramTypesResponse>(`${API_BASE_URL}/diagram-types`);
  },

  /**
   * A generate or revise turn, streamed.
   *
   * The same endpoint serves both: the backend routes to the revision path by
   * itself when the session already has a model, which is what makes case 1 and
   * case 2 of the brief a single call from here.
   *
   * Streaming is what answers "how are we minimizing latency" — each diagram's
   * PlantUML source arrives the moment it is projected, well before the JVM has
   * rendered it.
   */
  streamGenerate(
    sessionId: string,
    payload: { prompt: string; diagram_types?: string[]; userId?: string },
    signal?: AbortSignal,
  ): AsyncGenerator<RunEvent> {
    return streamRun(
      `${API_BASE_URL}/diagrams/generate/${encodeURIComponent(sessionId)}`,
      payload,
      signal,
    );
  },

  /** The blocking form of the same turn, kept for non-streaming callers. */
  generateDiagrams(
    sessionId: string,
    payload: { prompt: string; diagram_types?: string[]; userId?: string },
  ): Promise<GenerateResponse> {
    return json<GenerateResponse>(`${API_BASE_URL}/diagrams/generate/${encodeURIComponent(sessionId)}`, {
      ...postInit(payload),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });
  },

  /**
   * Another view of the model already stored.
   *
   * Costs zero LLM calls when the slice that view needs is already populated —
   * the response says so in `llmCalls`.
   */
  switchView(sessionId: string, diagramType: string): Promise<SwitchViewResponse> {
    return json<SwitchViewResponse>(
      `${API_BASE_URL}/diagrams/switch-view/${encodeURIComponent(sessionId)}`,
      postInit({ diagram_type: diagramType }),
    );
  },

  /** The rendered set for a session — the latest version, or a specific one. */
  listDiagrams(sessionId: string, version?: number): Promise<ListDiagramsResponse> {
    const query = version ? `?version=${version}` : '';
    return json<ListDiagramsResponse>(
      `${API_BASE_URL}/diagrams/${encodeURIComponent(sessionId)}${query}`,
    );
  },

  /** Sessions the backend still holds for a specific user (or global). */
  listSessions(userId?: string): Promise<SessionListResponse> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const headers = userId ? { 'x-user-id': userId } : undefined;
    return json<SessionListResponse>(`${API_BASE_URL}/sessions${query}`, { headers });
  },

  /** One session's turns, for rehydrating a transcript. */
  getSession(sessionId: string): Promise<SessionResponse> {
    return json<SessionResponse>(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`);
  },

  /** Clears working state. Ratings and trajectories survive on purpose. */
  deleteSession(sessionId: string): Promise<DeleteSessionResponse> {
    return json<DeleteSessionResponse>(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  },

  /** The canonical model itself — the reason every view stays consistent. */
  getCanonicalModel(sessionId: string, version?: number): Promise<CanonicalModelResponse> {
    const query = version ? `?version=${version}` : '';
    return json<CanonicalModelResponse>(
      `${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/model${query}`,
    );
  },

  /** A rating on one diagram. `diagramId` differs per version, so read it off the payload. */
  submitFeedback(payload: FeedbackSubmission): Promise<FeedbackResponse> {
    return json<FeedbackResponse>(`${API_BASE_URL}/feedback`, postInit(payload));
  },

  /** Ratings already given in this session, so a reload does not forget them. */
  listFeedback(sessionId: string): Promise<FeedbackListResponse> {
    return json<FeedbackListResponse>(
      `${API_BASE_URL}/feedback?sessionId=${encodeURIComponent(sessionId)}`,
    );
  },

  /** The JSONL the ART/GRPO trainer reads. */
  getFeedbackExportUrl(sessionId?: string): string {
    return sessionId
      ? `${API_BASE_URL}/feedback/export?sessionId=${encodeURIComponent(sessionId)}`
      : `${API_BASE_URL}/feedback/export`;
  },
};
