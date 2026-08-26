import {
  DiagramTypesResponse,
  BackendHealthResponse,
  GenerateResponse,
  SwitchViewResponse,
  SessionResponse,
  CanonicalModelResponse,
  FeedbackSubmission,
  FeedbackResponse,
} from '../types/uml';

const API_BASE_URL = '/api';

export const api = {
  /**
   * Health check for MongoDB, PlantUML and LLM providers
   */
  async checkHealth(): Promise<BackendHealthResponse> {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetch all 14 UML diagram types grouped by Structure, Behavior, and Interaction
   */
  async getDiagramTypes(): Promise<DiagramTypesResponse> {
    const response = await fetch(`${API_BASE_URL}/diagram-types`);
    if (!response.ok) {
      throw new Error(`Failed to fetch diagram types: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Generate UML diagrams for a session (New user or Existing user turn update)
   */
  async generateDiagrams(
    sessionId: string,
    payload: { prompt: string; diagram_types?: string[] }
  ): Promise<GenerateResponse> {
    const response = await fetch(`${API_BASE_URL}/diagrams/generate/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Generation failed with status ${response.status}`);
    }
    return data;
  },

  /**
   * Switch or generate an individual view on the canonical model (zero LLM calls if already rendered)
   */
  async switchView(sessionId: string, diagramType: string): Promise<SwitchViewResponse> {
    const response = await fetch(`${API_BASE_URL}/diagrams/switch-view/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ diagram_type: diagramType }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Switch view failed: ${response.statusText}`);
    }
    return data;
  },

  /**
   * List all generated diagrams for current session version
   */
  async listDiagrams(sessionId: string): Promise<{ success: boolean; sessionId: string; version: number; total: number; diagrams: any[] }> {
    const response = await fetch(`${API_BASE_URL}/diagrams/${encodeURIComponent(sessionId)}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Failed to fetch diagrams: ${response.statusText}`);
    }
    return data;
  },

  /**
   * Get complete session turns and history
   */
  async getSession(sessionId: string): Promise<SessionResponse> {
    const response = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Failed to fetch session: ${response.statusText}`);
    }
    return data;
  },

  /**
   * Delete session working state
   */
  async deleteSession(sessionId: string): Promise<{ success: boolean; sessionId: string; deleted: any; note: string }> {
    const response = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Failed to reset session: ${response.statusText}`);
    }
    return data;
  },

  /**
   * Get canonical semantic model (CSM) for debugging/inspection
   */
  async getCanonicalModel(sessionId: string, version?: number): Promise<CanonicalModelResponse> {
    const query = version ? `?version=${version}` : '';
    const response = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/model${query}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Failed to fetch canonical model: ${response.statusText}`);
    }
    return data;
  },

  /**
   * Submit user rating and feedback on a diagram for RL trainer
   */
  async submitFeedback(payload: FeedbackSubmission): Promise<FeedbackResponse> {
    const response = await fetch(`${API_BASE_URL}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Feedback submission failed: ${response.statusText}`);
    }
    return data;
  },

  /**
   * URL to export RL training data (JSONL)
   */
  getFeedbackExportUrl(sessionId?: string): string {
    return sessionId
      ? `${API_BASE_URL}/feedback/export?sessionId=${encodeURIComponent(sessionId)}`
      : `${API_BASE_URL}/feedback/export`;
  },
};
