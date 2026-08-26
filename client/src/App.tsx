import { useState, useEffect, FC } from 'react';
import { api } from './services/api';
import {
  UMLModel,
  DiagramTypesResponse,
  RenderedDiagram,
  GenerateResponse,
  SessionResponse,
  CanonicalModelResponse,
  BackendHealthResponse
} from './types/uml';
import {
  Server,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Layers,
  Activity,
  Workflow,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  Code2,
  History,
  Download,
  Cpu,
  Check,
  PlusCircle
} from 'lucide-react';
import './App.css';

export const App: FC = () => {
  const defaultSessionId = 'sess_' + Math.random().toString(36).substring(2, 9);
  const [sessionId, setSessionId] = useState<string>(() => {
    return localStorage.getItem('uml_session_id') || defaultSessionId;
  });

  const [diagramTypesData, setDiagramTypesData] = useState<DiagramTypesResponse | null>(null);
  const [healthData, setHealthData] = useState<BackendHealthResponse | null>(null);
  const [isLoadingTypes, setIsLoadingTypes] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSwitchingView, setIsSwitchingView] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'checking' | 'error'>('checking');

  // Input states
  const [prompt, setPrompt] = useState<string>(
    `I am working on a compliance monitoring solution which will pull in the latest circulars from SEBI and parse them. Once it is parsed into a table of clauses, you will need to extract the following information:\n1. The new compliance requirements proposed by the regulator\n2. Gap analysis with my existing compliance setup\n3. The impact of these new compliance requirements on my organization at an IT and operational level`
  );

  const [selectedDiagrams, setSelectedDiagrams] = useState<string[]>([
    'class',
    'sequence',
    'component'
  ]);

  // Response results state
  const [, setGenerationResult] = useState<GenerateResponse | null>(null);
  const [diagrams, setDiagrams] = useState<RenderedDiagram[]>([]);
  const [activeDiagramIndex, setActiveDiagramIndex] = useState<number>(0);
  const [sessionHistory, setSessionHistory] = useState<SessionResponse | null>(null);
  const [canonicalModel, setCanonicalModel] = useState<CanonicalModelResponse | null>(null);
  const [showRawModel, setShowRawModel] = useState<boolean>(false);
  const [showSourceCode, setShowSourceCode] = useState<boolean>(false);

  // Feedback status map: { diagramId: { rating: 'up'|'down', comments?: string, submitted: boolean } }
  const [feedbackMap, setFeedbackMap] = useState<Record<string, { rating?: 'up' | 'down'; comments?: string; submitting?: boolean; success?: boolean }>>({});
  const [feedbackComment, setFeedbackComment] = useState<string>('');

  // Save session ID
  useEffect(() => {
    localStorage.setItem('uml_session_id', sessionId);
  }, [sessionId]);

  // Load initial backend metadata and session
  const initApp = async () => {
    setIsLoadingTypes(true);
    setError(null);
    setBackendStatus('checking');
    try {
      const [healthRes, typesResponse] = await Promise.all([
        api.checkHealth().catch(() => null),
        api.getDiagramTypes()
      ]);
      setHealthData(healthRes);
      setDiagramTypesData(typesResponse);
      setBackendStatus(healthRes?.status === 'ok' ? 'connected' : 'error');

      // Check if current session has existing diagrams
      try {
        const existingSession = await api.getSession(sessionId);
        setSessionHistory(existingSession);
        const existingDiagrams = await api.listDiagrams(sessionId);
        if (existingDiagrams && existingDiagrams.diagrams?.length > 0) {
          setDiagrams(existingDiagrams.diagrams);
        }
      } catch {
        // No session yet, normal for a new user
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not connect to backend server';
      setError(message);
      setBackendStatus('error');
    } finally {
      setIsLoadingTypes(false);
    }
  };

  useEffect(() => {
    initApp();
  }, []);

  const allModels: UMLModel[] = diagramTypesData?.data || [];

  const handleToggle = (id: string) => {
    if (selectedDiagrams.includes(id)) {
      setSelectedDiagrams(selectedDiagrams.filter((item) => item !== id));
    } else {
      setSelectedDiagrams([...selectedDiagrams, id]);
    }
  };

  const handleSelectAll = () => setSelectedDiagrams(allModels.map((m) => m.id));
  const handleClearAll = () => setSelectedDiagrams([]);
  const handleSelectStructureOnly = () => {
    setSelectedDiagrams(allModels.filter((m) => m.category === 'Structure').map((m) => m.id));
  };
  const handleSelectBehaviorOnly = () => {
    setSelectedDiagrams(allModels.filter((m) => m.category === 'Behavior').map((m) => m.id));
  };
  const handleSelectInteractionOnly = () => {
    setSelectedDiagrams(allModels.filter((m) => m.subcategory === 'Interaction').map((m) => m.id));
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || selectedDiagrams.length === 0) return;

    setIsGenerating(true);
    setError(null);
    try {
      const response = await api.generateDiagrams(sessionId, {
        prompt,
        diagram_types: selectedDiagrams
      });
      setGenerationResult(response);
      if (response.diagrams && response.diagrams.length > 0) {
        setDiagrams(response.diagrams);
        setActiveDiagramIndex(0);
      }
      // Refresh session history & canonical model
      refreshSessionAndModel();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate UML diagrams';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSwitchView = async (typeId: string) => {
    setIsSwitchingView(true);
    setError(null);
    try {
      const response = await api.switchView(sessionId, typeId);
      if (response.diagram) {
        setDiagrams((prev) => {
          const index = prev.findIndex((d) => d.type === response.diagram.type);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = response.diagram;
            return updated;
          }
          return [...prev, response.diagram];
        });
        // Switch active index to this newly generated/rendered diagram
        const foundIndex = diagrams.findIndex((d) => d.type === response.diagram.type);
        if (foundIndex >= 0) {
          setActiveDiagramIndex(foundIndex);
        } else {
          setActiveDiagramIndex(diagrams.length);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to switch diagram view';
      setError(msg);
    } finally {
      setIsSwitchingView(false);
    }
  };

  const refreshSessionAndModel = async () => {
    try {
      const [sess, model] = await Promise.all([
        api.getSession(sessionId).catch(() => null),
        api.getCanonicalModel(sessionId).catch(() => null)
      ]);
      if (sess) setSessionHistory(sess);
      if (model) setCanonicalModel(model);
    } catch {
      // ignore non-fatal info refreshes
    }
  };

  const handleNewSession = () => {
    const newId = 'sess_' + Math.random().toString(36).substring(2, 9);
    setSessionId(newId);
    setDiagrams([]);
    setGenerationResult(null);
    setSessionHistory(null);
    setCanonicalModel(null);
    setError(null);
  };

  const handleDeleteSession = async () => {
    if (!confirm('Reset current session data on server? (Feedback and trajectories will be preserved for RL)')) return;
    try {
      await api.deleteSession(sessionId);
      handleNewSession();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete session';
      setError(msg);
    }
  };

  const handleFeedback = async (rating: 'up' | 'down') => {
    const currentDiagram = diagrams[activeDiagramIndex];
    const dId = currentDiagram?.diagramId || currentDiagram?._id;
    if (!dId) return;

    setFeedbackMap((prev) => ({
      ...prev,
      [dId]: { ...prev[dId], rating, submitting: true, success: false }
    }));

    try {
      await api.submitFeedback({
        sessionId,
        diagramId: dId,
        rating,
        comments: feedbackComment.trim() || undefined
      });
      setFeedbackMap((prev) => ({
        ...prev,
        [dId]: { rating, comments: feedbackComment, submitting: false, success: true }
      }));
      setFeedbackComment('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit feedback';
      setError(msg);
      setFeedbackMap((prev) => ({
        ...prev,
        [dId]: { ...prev[dId], submitting: false, success: false }
      }));
    }
  };

  const activeDiagram = diagrams[activeDiagramIndex];
  const activeDiagramId = activeDiagram?.diagramId || activeDiagram?._id;
  const currentFeedback = activeDiagramId ? feedbackMap[activeDiagramId] : undefined;

  const structureModels = diagramTypesData?.categories.structure.items || [];
  const behaviorGeneralModels = diagramTypesData?.categories.behavior.items || [];
  const interactionModels = diagramTypesData?.categories.interaction.items || [];

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="header-top">
          <div className="brand">
            <div className="brand-icon">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="brand-title-row">
                <h1>UML Architecture & Code Generator</h1>
                <span className="badge version-badge">Session: {sessionId}</span>
              </div>
              <p className="subtitle">Interactive Multi-Model UML Generator & RL Feedback Collector</p>
            </div>
          </div>

          <div className="header-actions">
            {/* Session Management Buttons */}
            <button type="button" className="btn-secondary" onClick={handleNewSession} title="Start new session">
              <PlusCircle size={15} /> New Session
            </button>
            {sessionHistory && (
              <button type="button" className="btn-danger" onClick={handleDeleteSession} title="Reset session state">
                <Trash2 size={15} /> Reset
              </button>
            )}

            {/* Backend Status Pill */}
            <div className={`status-pill ${backendStatus}`}>
              <Server size={14} />
              <span>
                {backendStatus === 'connected' && `Backend Ready (${healthData?.checks?.plantuml || 'PlantUML Ready'})`}
                {backendStatus === 'checking' && 'Connecting...'}
                {backendStatus === 'error' && 'Backend Disconnected'}
              </span>
              {backendStatus === 'connected' && <CheckCircle2 size={14} className="status-icon success" />}
              {backendStatus === 'checking' && <RefreshCw size={14} className="status-icon spinning" />}
              {backendStatus === 'error' && (
                <button type="button" className="retry-pill-btn" onClick={initApp}>
                  <RefreshCw size={12} /> Retry
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <div className="error-content">
            <strong>Error:</strong> {error}
          </div>
          <button type="button" className="retry-btn" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="main-grid">
        {/* Left Column: Input Form & Diagram Selection */}
        <section className="input-column">
          <form onSubmit={handleGenerate} className="form-card">
            <div className="card-header">
              <h2>1. System Prompt Specification</h2>
              {sessionHistory && sessionHistory.turns?.length > 0 && (
                <span className="badge turn-badge">
                  Turn #{sessionHistory.currentVersion} (Patch Mode)
                </span>
              )}
            </div>

            <div className="form-group">
              <textarea
                id="prompt-input"
                className="textarea-field"
                rows={7}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your architecture requirements, classes, sequence flows, components..."
                required
              />
            </div>

            {/* Diagram Types Selection */}
            <div className="form-group">
              <div className="selection-header">
                <label className="form-label">
                  2. Select UML Diagram Types ({selectedDiagrams.length} / {allModels.length || 14})
                </label>
                <div className="quick-actions">
                  <button type="button" className="action-link" onClick={handleSelectAll}>All (14)</button>
                  <span>•</span>
                  <button type="button" className="action-link" onClick={handleSelectStructureOnly}>Structure (7)</button>
                  <span>•</span>
                  <button type="button" className="action-link" onClick={handleSelectBehaviorOnly}>Behavior (7)</button>
                  <span>•</span>
                  <button type="button" className="action-link" onClick={handleSelectInteractionOnly}>Interaction (4)</button>
                  <span>•</span>
                  <button type="button" className="action-link clear" onClick={handleClearAll}>Clear</button>
                </div>
              </div>

              {isLoadingTypes ? (
                <div className="loading-state">
                  <RefreshCw className="spinning" size={18} />
                  <span>Loading diagram catalog from backend...</span>
                </div>
              ) : (
                <div className="categories-stack">
                  {/* Structure */}
                  <div className="category-section">
                    <div className="category-title-row">
                      <Layers size={14} className="cat-icon structure-color" />
                      <span className="category-title">Structure Diagrams</span>
                    </div>
                    <div className="checkbox-grid">
                      {structureModels.map((model) => {
                        const isChecked = selectedDiagrams.includes(model.id);
                        return (
                          <label key={model.id} className={`checkbox-card ${isChecked ? 'checked' : ''}`} title={model.description}>
                            <input type="checkbox" checked={isChecked} onChange={() => handleToggle(model.id)} />
                            <span className="model-name">{model.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Behavior */}
                  <div className="category-section">
                    <div className="category-title-row">
                      <Activity size={14} className="cat-icon behavior-color" />
                      <span className="category-title">Behavior Diagrams</span>
                    </div>
                    <div className="checkbox-grid">
                      {behaviorGeneralModels.map((model) => {
                        const isChecked = selectedDiagrams.includes(model.id);
                        return (
                          <label key={model.id} className={`checkbox-card ${isChecked ? 'checked' : ''}`} title={model.description}>
                            <input type="checkbox" checked={isChecked} onChange={() => handleToggle(model.id)} />
                            <span className="model-name">{model.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interaction */}
                  <div className="category-section">
                    <div className="category-title-row">
                      <Workflow size={14} className="cat-icon interaction-color" />
                      <span className="category-title">Interaction Diagrams</span>
                    </div>
                    <div className="checkbox-grid">
                      {interactionModels.map((model) => {
                        const isChecked = selectedDiagrams.includes(model.id);
                        return (
                          <label key={model.id} className={`checkbox-card interaction ${isChecked ? 'checked' : ''}`} title={model.description}>
                            <input type="checkbox" checked={isChecked} onChange={() => handleToggle(model.id)} />
                            <span className="model-name">{model.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={isGenerating || !prompt.trim() || selectedDiagrams.length === 0}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="spinning" size={18} />
                  <span>Synthesizing Model & Generating PlantUML...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Generate Diagrams ({selectedDiagrams.length})</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Switch View Section */}
          {diagrams.length > 0 && (
            <div className="form-card switch-view-card">
              <div className="card-header">
                <h3>Quick Switch View (Zero/Low LLM Cost)</h3>
              </div>
              <p className="card-desc">Project another diagram type from the current Canonical Semantic Model:</p>
              <div className="quick-switch-pills">
                {allModels.map((m) => {
                  const isRendered = diagrams.some((d) => d.type === m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={isSwitchingView}
                      className={`switch-pill ${isRendered ? 'active' : ''}`}
                      onClick={() => handleSwitchView(m.id)}
                    >
                      {m.name} {isRendered ? '✓' : '+'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* RL Dataset Export Box */}
          <div className="form-card export-card">
            <div className="card-header">
              <h3>RL Trainer Dataset (ART / LangChain)</h3>
            </div>
            <p className="card-desc">Download feedback-scored trajectories as JSONL for RLHF / GRPO fine-tuning:</p>
            <div className="export-buttons">
              <a
                href={api.getFeedbackExportUrl(sessionId)}
                download="session_rl_training_data.jsonl"
                className="btn-outline"
                target="_blank"
                rel="noreferrer"
              >
                <Download size={14} /> Export Session JSONL
              </a>
              <a
                href={api.getFeedbackExportUrl()}
                download="all_rl_training_data.jsonl"
                className="btn-outline"
                target="_blank"
                rel="noreferrer"
              >
                <Download size={14} /> Export Global JSONL
              </a>
            </div>
          </div>
        </section>

        {/* Right Column: Diagram Viewer & Feedback System */}
        <section className="output-column">
          {diagrams.length > 0 ? (
            <div className="viewer-card">
              {/* Diagram Tabs */}
              <div className="diagram-tabs-container">
                <div className="diagram-tabs">
                  {diagrams.map((diag, idx) => (
                    <button
                      key={diag.type + idx}
                      type="button"
                      className={`tab-btn ${idx === activeDiagramIndex ? 'active' : ''}`}
                      onClick={() => setActiveDiagramIndex(idx)}
                    >
                      <span className="tab-name">{diag.type}</span>
                      {diag.valid ? (
                        <span className="status-dot valid" title="Valid PlantUML Syntax" />
                      ) : (
                        <span className="status-dot invalid" title="Syntax Warning" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="tab-controls">
                  <button
                    type="button"
                    className={`btn-ghost ${showSourceCode ? 'active' : ''}`}
                    onClick={() => setShowSourceCode(!showSourceCode)}
                    title="Toggle PlantUML Source"
                  >
                    <Code2 size={16} />
                  </button>
                  <button
                    type="button"
                    className={`btn-ghost ${showRawModel ? 'active' : ''}`}
                    onClick={() => {
                      if (!canonicalModel) refreshSessionAndModel();
                      setShowRawModel(!showRawModel);
                    }}
                    title="Toggle Canonical Model (CSM)"
                  >
                    <Cpu size={16} />
                  </button>
                </div>
              </div>

              {/* Viewport Content */}
              <div className="diagram-viewport">
                {showRawModel && canonicalModel ? (
                  <div className="raw-model-view">
                    <div className="view-title">
                      <h4>Canonical Semantic Model (CSM) - Version {canonicalModel.version}</h4>
                      {canonicalModel.rationale && <p className="rationale">Rationale: {canonicalModel.rationale}</p>}
                    </div>
                    <pre className="json-box">{JSON.stringify(canonicalModel.csm, null, 2)}</pre>
                  </div>
                ) : showSourceCode && activeDiagram ? (
                  <div className="source-code-view">
                    <div className="view-title">
                      <h4>PlantUML Source Code ({activeDiagram.type})</h4>
                    </div>
                    <pre className="plantuml-box">{activeDiagram.source}</pre>
                  </div>
                ) : activeDiagram ? (
                  <div className="diagram-render-view">
                    {activeDiagram.svg ? (
                      <div
                        className="svg-container"
                        dangerouslySetInnerHTML={{ __html: activeDiagram.svg }}
                      />
                    ) : activeDiagram.pngUrl ? (
                      <img src={activeDiagram.pngUrl} alt={`${activeDiagram.type} diagram`} className="diagram-img" />
                    ) : (
                      <div className="placeholder-render">
                        <p>Diagram source available, rendering preview...</p>
                        <pre className="plantuml-box">{activeDiagram.source}</pre>
                      </div>
                    )}

                    {activeDiagram.errors && activeDiagram.errors.length > 0 && (
                      <div className="render-warnings">
                        <AlertCircle size={15} />
                        <span>Render Note: {activeDiagram.errors.join(', ')}</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Feedback and RL Section */}
              {activeDiagram && (
                <div className="feedback-bar">
                  <div className="feedback-title-group">
                    <h4>Rate Diagram Quality (RLHF / ART)</h4>
                    <span className="diagram-indicator">Active: <strong>{activeDiagram.type}</strong></span>
                  </div>

                  <div className="feedback-controls">
                    <div className="rating-buttons">
                      <button
                        type="button"
                        className={`rate-btn up ${currentFeedback?.rating === 'up' ? 'selected' : ''}`}
                        onClick={() => handleFeedback('up')}
                        disabled={currentFeedback?.submitting}
                      >
                        <ThumbsUp size={16} /> <span>Accurate (+1.0)</span>
                      </button>
                      <button
                        type="button"
                        className={`rate-btn down ${currentFeedback?.rating === 'down' ? 'selected' : ''}`}
                        onClick={() => handleFeedback('down')}
                        disabled={currentFeedback?.submitting}
                      >
                        <ThumbsDown size={16} /> <span>Flawed (-1.0)</span>
                      </button>
                    </div>

                    <div className="comment-input-row">
                      <input
                        type="text"
                        className="comment-field"
                        placeholder="Optional feedback notes for the ART RL trainer..."
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                      />
                      {currentFeedback?.success && (
                        <span className="feedback-success-badge">
                          <Check size={14} /> Saved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Empty State */
            <div className="empty-state-card">
              <Workflow size={48} className="empty-icon" />
              <h3>No Diagrams Generated Yet</h3>
              <p>
                Enter your system design requirements on the left, select your preferred UML diagram types, and click <strong>Generate Diagrams</strong>.
              </p>
              <div className="feature-list">
                <div className="feature-item">
                  <CheckCircle2 size={16} /> <span>14 Canonical UML 2.x Models supported</span>
                </div>
                <div className="feature-item">
                  <CheckCircle2 size={16} /> <span>Canonical Semantic Model (CSM) consistency across turns</span>
                </div>
                <div className="feature-item">
                  <CheckCircle2 size={16} /> <span>Real-time RL reward feedback and trajectory logging</span>
                </div>
              </div>
            </div>
          )}

          {/* Session Turns & History Card */}
          {sessionHistory && sessionHistory.turns?.length > 0 && (
            <div className="history-card">
              <div className="card-header">
                <div className="header-with-icon">
                  <History size={16} />
                  <h3>Conversation Turns & Architecture History</h3>
                </div>
                <span className="badge">{sessionHistory.turns.length} Turns</span>
              </div>
              <div className="turns-list">
                {sessionHistory.turns.map((turn, i) => (
                  <div key={turn.version + '-' + i} className="turn-item">
                    <div className="turn-top">
                      <span className="turn-badge-pill">Version {turn.version} ({turn.kind})</span>
                      <span className="turn-time">{new Date(turn.at).toLocaleTimeString()}</span>
                    </div>
                    <p className="turn-prompt">"{turn.prompt}"</p>
                    <div className="turn-diagrams">
                      {turn.diagrams.map((d, dIdx) => (
                        <span key={d.type + dIdx} className="turn-diag-tag">
                          {d.type} {d.carriedForward ? '(cached)' : '(fresh)'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default App;
