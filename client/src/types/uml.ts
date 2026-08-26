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

export interface BackendHealthResponse {
  status: string;
  message: string;
  timestamp: string;
  checks?: {
    mongo: string;
    plantuml: string;
    groq: string;
    model?: string;
  };
}

export interface RenderedDiagram {
  diagramId?: string;
  _id?: string;
  type: string;
  source: string;
  svg?: string;
  pngUrl?: string | null;
  valid: boolean;
  errors?: string[];
  repairAttempts?: number;
  carriedForward?: boolean;
}

export interface GenerateResponse {
  success: boolean;
  sessionId: string;
  version: number;
  durationMs?: number;
  diagrams: RenderedDiagram[];
  rationale?: string;
  integrity?: {
    ok: boolean;
    issues?: string[];
  };
  metrics?: {
    llmCalls?: number;
    tokens?: number;
  };
}

export interface SwitchViewResponse {
  success: boolean;
  sessionId: string;
  diagram: RenderedDiagram;
  llmCalls?: number;
}

export interface SessionTurn {
  version: number;
  kind: string;
  prompt: string;
  diagramTypes: string[];
  at: string;
  diagrams: {
    type: string;
    valid: boolean;
    carriedForward: boolean;
  }[];
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

export interface CanonicalModelResponse {
  success: boolean;
  sessionId: string;
  version: number;
  rationale?: string;
  integrity?: {
    ok: boolean;
    issues?: string[];
  };
  csm: any;
}

export interface FeedbackSubmission {
  sessionId: string;
  diagramId: string;
  rating: 'up' | 'down' | 'thumbs_up' | 'thumbs_down';
  comments?: string | null;
}

export interface FeedbackResponse {
  success: boolean;
  feedbackId: string;
  sessionId: string;
  diagramType: string;
  version: number;
  reward: number;
}
