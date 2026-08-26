# 🚀 Agentic UML Generator

An intelligent, multi-turn AI-powered software architecture platform that transforms natural language software requirements into verified, high-fidelity **UML 2.x diagrams**.

Built with a **Canonical Software Model (CSM)** approach, deterministic projectors, automated self-healing syntax repair loops, user-scoped workspaces, and an **Adaptive Refinement & Training (ART)** reinforcement learning feedback system.

---

## 🌟 Key Highlights

- **👤 User Identification & Scoped Workspaces**: Name-based authentication that dynamically creates unique `userId`s (e.g. `usr_tony`), recognizes returning users, and isolates architecture sessions per user.
- **🧠 Canonical Software Model (CSM)**: Extracts a unified, structured architecture model from user prompts to ensure consistent domain concepts across every diagram type.
- **📐 Complete UML 2.x Support**: Out-of-the-box support for all 14 standard UML 2.x structure and behavior diagram types.
- **⚡ Deterministic Projectors & Low Latency**: Translates structured CSM data into valid PlantUML using type-safe deterministic TypeScript projectors, minimizing hallucinations and latency.
- **🛡️ Self-Healing PlantUML Verification**: Compiles diagrams with PlantUML backend validation and automatically repairs syntax errors before returning results to the client.
- **🔄 Multi-Turn Iterative Refinement**: Supports conversational updates, incremental prompt edits, and instant diagram view-switching without re-computing unchanged architecture state.
- **🎯 ART & Reinforcement Learning (RL) Dataset Exporter**: Records full execution trajectories (prompts, completions, tool calls, reasoning steps, latencies) and exports automatically-captured feedback as JSONL for RLHF / DPO / GRPO fine-tuning — no rating UI, the reward signal comes entirely from user behavior.
- **📡 Real-Time SSE Pipeline Streaming**: Live status events streamed to the UI as extraction, projection, validation, and rendering steps execute.
- **🎨 Interactive Canvas & Studio UI**: Modern React frontend with user switcher, pan, zoom, full-screen mode, PlantUML code preview, instant copy, and PNG/SVG export capabilities.

---

## 🗺️ Supported UML 2.x Diagram Types

| Category | Diagram Type | Description & Primary Use Case |
| :--- | :--- | :--- |
| **Structure** | **Class** | Domain and API models, class hierarchies, attributes, operations, and relationships. |
| **Structure** | **Object** | Runtime instance snapshots, test fixture representations, and object graphs. |
| **Structure** | **Component** | High-level architectural building blocks, subsystems, and provided/required ports. |
| **Structure** | **Composite Structure**| Internal wiring, parts, ports, and connectors within a component or class. |
| **Structure** | **Deployment** | Infrastructure topology, container runtime environments, nodes, and artifacts. |
| **Structure** | **Package** | Modular breakdown, namespace hierarchies, and package-level dependencies. |
| **Structure** | **Profile** | Stereotypes, tagged values, and domain-specific metamodel extensions. |
| **Behavior** | **Use Case** | Actor goals, system boundaries, and user interactions. |
| **Behavior** | **Activity** | Workflow pipelines, business processes, forks/joins, and decision logic. |
| **Behavior** | **State Machine** | Entity lifecycles, state transitions, events, actions, and guard conditions. |
| **Behavior (Interaction)** | **Sequence** | Chronological message flows, async/sync calls, alt blocks, and lifelines. |
| **Behavior (Interaction)** | **Communication** | Structural interactions focusing on participant relationships and numbered messages. |
| **Behavior (Interaction)** | **Interaction Overview**| High-level control-flow connecting multiple sequence diagrams. |
| **Behavior (Interaction)** | **Timing** | State and condition changes along a continuous timeline for real-time systems. |

---

## 🔄 User Lifecycle & Core Workflows

The platform handles three core usage scenarios:

```mermaid
flowchart TD
    Start(["User Enters Name (e.g. Tony)"]) --> Identify{"Name in DB?"}
    
    Identify -->|No - New User| CreateUser["Create Profile (usr_tony)<br/>isNewUser = true"]
    Identify -->|Yes - Existing User| LoadUser["Load Existing Profile<br/>isNewUser = false"]
    
    CreateUser --> FreshWorkspace["1. New User Scenario:<br/>Start fresh session, extract CSM from scratch,<br/>generate initial diagrams"]
    
    LoadUser --> FetchSessions["Fetch Tony's Sessions<br/>(GET /api/sessions?userId=usr_tony)"]
    FetchSessions --> ExistingWorkspace["2. Existing User Scenario:<br/>Auto-load latest session or revise existing CSM via diff patch"]
    
    FreshWorkspace --> UserFeedback
    ExistingWorkspace --> UserFeedback
    
    UserFeedback["3. Feedback Scenario:<br/>Pipeline observes what the user does next"]
    UserFeedback --> LogTrajectory["Persist automatic signal mapped to session & version"]
    LogTrajectory --> ExportRL["Export JSONL Trajectory for ART / RLHF fine-tuning"]
```

1. **New User (`isNewUser: true`)**:
   - User inputs their name upon arrival.
   - A unique identifier (e.g., `usr_tony`) is minted and persisted in MongoDB.
   - The session generates a fresh Canonical Software Model (CSM) from scratch.
2. **Existing User (`isNewUser: false`)**:
   - Returning user names are automatically matched (case-insensitively).
   - Past architecture sessions and rendered diagrams are loaded in the sidebar.
   - Subsequent prompts compute incremental **CSM Patches / Diffs**, reusing unchanged diagram slices.
3. **Feedback & Continuous Improvement**:
   - There is no rating widget — the pipeline reads feedback out of behavior instead: a diagram that gets reworked by the next revision is an implicit negative, one that survives revision after revision untouched is an implicit positive, and render quality (clean vs. needed repair vs. failed) is a third, purely mechanical signal. See `server/src/agent/implicitSignals.ts`.
   - Every signal is tied to the exact LLM trajectory that produced the content and exported for RL / ART model training.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    User(["Client UI"]) -->|1. Identify User| UserAPI["/api/users/identify"]
    UserAPI --> UserDB[("MongoDB Users")]
    
    User -->|2. Prompt + Diagram Types + userId| API["Express API / SSE Stream"]
    API --> Pipeline["Agentic Pipeline"]
    
    subgraph Agentic Pipeline
        Pipeline --> ModeCheck{"Existing Session?"}
        ModeCheck -->|No| CSM["CSM Extraction Node"]
        ModeCheck -->|Yes| CSMPatch["CSM Revision Patch Node"]
        
        CSM -->|"Groq LLM (Structured Output)"| CSM_Model[("Canonical Software Model")]
        CSMPatch -->|"Incremental Diff"| CSM_Model
        
        CSM_Model --> Integrity["CSM Integrity Validator"]
        Integrity --> Projectors["Deterministic UML Projectors"]
        Projectors --> PlantUML_Code["PlantUML Code Generation"]
        PlantUML_Code --> Compiler["PlantUML Compiler Engine"]
        Compiler -->|Syntax Error Detected| SelfRepair["Self-Healing Repair Loop"]
        SelfRepair -->|"Fixed AST / Code"| Compiler
        Compiler -->|Success| DiagramAssets["Rendered SVG / PNG Images"]
    end

    DiagramAssets --> DB[("MongoDB Atlas (Thread, Diagram, CSM)")]
    DiagramAssets --> User
    
    Pipeline -->|"3. Revision rework / carry-forward streak / render quality"| FeedbackController["Implicit Signal Capture"]
    FeedbackController --> TrajectoryStore[("Trajectory & Feedback Store")]
    TrajectoryStore --> ExportRL["Feedback Dataset Export (JSONL)"]
    ExportRL --> ART["LangChain ART / RLHF / DPO Trainer"]
```

---

## 💻 Tech Stack

### Frontend (`/client`)
- **Framework**: React 19 + TypeScript + Vite + TailwindCSS
- **Icons**: Phosphor Icons
- **State & Hooks**: `useUser`, `useSessions`, `useChat`, `useHealth`, `useDiagramTypes`
- **Features**: User identification modal, user switcher, interactive zoom/pan canvas, real-time SSE progress trail, PlantUML code preview, export utilities. No rating UI — feedback is captured automatically server-side.

### Backend (`/server`)
- **Runtime**: Node.js (ES Modules) + Express 5 + TypeScript
- **Database**: MongoDB with Mongoose (`User`, `Thread`, `Diagram`, `CsmVersion`, `Trajectory`, `Feedback`)
- **LLM Integration**: Groq SDK (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`) with JSON schema constrained decoding
- **Concurrency & Resilience**: `p-limit`, `p-retry`
- **UML Engine**: Dual backend support:
  - Local Java `plantuml.jar` execution
  - Remote / Docker PlantUML HTTP Server
- **Testing**: Vitest for unit, integration, and projector snapshot testing

---

## 📁 Repository Structure

```
umlgenerator/
├── client/                     # Frontend Application
│   ├── src/
│   │   ├── components/         # UI Components (UserModal, SessionSidebar, Composer, DiagramView, etc.)
│   │   ├── hooks/              # Custom React Hooks (useUser, useSessions, useChat, etc.)
│   │   ├── services/           # API and SSE client services
│   │   ├── types/              # Frontend TypeScript contracts
│   │   ├── App.tsx             # Main UML Studio Application & Canvas
│   │   └── main.tsx            # Entry point
│   ├── package.json
│   └── vite.config.ts
├── server/                     # Backend Application
│   ├── src/
│   │   ├── agent/              # Agentic pipeline, LLM nodes, CSM integrity & schemas
│   │   ├── config/             # Database and environment configurations
│   │   ├── controllers/        # User, diagram, session, image, and feedback controllers
│   │   ├── models/             # Mongoose schemas (User, Thread, Diagram, CsmVersion, Trajectory, Feedback)
│   │   ├── plantuml/           # PlantUML rendering engine & JAR/Server abstractions
│   │   ├── projectors/         # 14 Deterministic CSM -> PlantUML Projectors
│   │   ├── routes/             # REST endpoints for users, diagrams, sessions, and feedback
│   │   ├── lib/                # HTTP error & SSE stream utilities
│   │   ├── app.ts              # Express application factory
│   │   └── server.ts           # Server bootstrap
│   ├── scripts/
│   │   └── fetch-plantuml.mjs  # Automation script to fetch latest PlantUML jar
│   ├── test/                   # Vitest test suite
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ (v20+ recommended)
- **npm** or **pnpm**
- **Java JRE/JDK** (version 11+ for local `plantuml.jar`) *or* Docker for PlantUML Server
- **MongoDB**: Local instance or MongoDB Atlas connection string
- **Groq API Key**: Obtainable from [console.groq.com](https://console.groq.com/keys)

---

### 1. Backend Setup

1. Open a terminal and navigate to `server`:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Download the local PlantUML binary:
   ```bash
   npm run fetch:plantuml
   ```

4. Create your `.env` configuration:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your credentials:
   ```env
   PORT=5001
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/umlgenerator
   GROQ_API_KEY=gsk_your_actual_groq_api_key_here
   
   MODEL_PRIMARY=openai/gpt-oss-120b
   MODEL_FAST=openai/gpt-oss-20b
   
   PLANTUML_BACKEND=jar
   PLANTUML_JAR=vendor/plantuml.jar
   JAVA_BIN=java
   ```

5. Start the backend development server:
   ```bash
   npm run dev
   ```
   The backend will be running at `http://localhost:5001`.

---

### 2. Frontend Setup

1. Open another terminal and navigate to `client`:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The application UI will be accessible at `http://localhost:5173`.

---

## 🧪 Testing

Run test suites for projectors, CSM integrity validation, and API routes:

```bash
cd server
npm test
```

For watch mode during development:
```bash
npm run test:watch
```

---

## 📡 API Reference

### User Management
- `POST /api/users/identify` — Identifies or registers a user by name (`{ name }`). Returns `{ isNewUser, user }`.
- `GET /api/users` — Returns a list of known users in the system.
- `GET /api/users/:userId` — Retrieves user profile details.

### Health Check
- `GET /api/health` — Checks status of MongoDB, PlantUML engine, and Groq configuration.

### Diagrams & Generation
- `GET /api/diagram-types` — Returns metadata for all 14 supported UML diagram types.
- `POST /api/diagrams/generate/:sessionId` — Initiates multi-diagram generation pipeline with SSE stream output (`{ prompt, diagram_types, userId }`).
- `POST /api/diagrams/switch-view/:sessionId` — Instantly projects and renders an alternate diagram type from the existing CSM.
- `GET /api/diagrams/:sessionId?version=N` — Retrieves rendered diagrams for a session (optionally at version N).
- `GET /api/diagram/:session/:filename` — Serves rendered SVG / PNG diagram assets.

### Sessions
- `GET /api/sessions?userId=...` — Returns active sessions filtered by user (`userId` via query param or `x-user-id` header).
- `GET /api/sessions/:sessionId` — Fetches session details and complete turn history.
- `GET /api/sessions/:sessionId/model` — Returns the current Canonical Software Model (CSM) JSON.
- `DELETE /api/sessions/:sessionId` — Deletes session and associated diagrams.

### Feedback & Reinforcement Learning (RL)
- `GET /api/feedback/export` — Streams JSONL dataset with full trajectories and scalar rewards for LangChain ART / GRPO fine-tuning.

There is no submit/list endpoint — feedback isn't something a client posts. The pipeline writes it itself as a byproduct of running a turn (see below).

---

## 🧠 Reinforcement Learning & ART Dataset Export

There is no rating widget in this app. Every diagram's reward comes from three signals the pipeline records automatically, with zero user input (`server/src/agent/implicitSignals.ts`):

| Signal | Fires when | Reward |
| :--- | :--- | :--- |
| `render-quality` | Every render: invalid PlantUML, needed auto-repair, or rendered clean | −0.4 / up to −0.2 / +0.1 |
| `revision-rework` | A later revision touches this diagram's CSM slices — bigger, faster corrections score more negative | up to −0.5 |
| `survived-carry-forward` | The user keeps revising *other* things and this diagram type rides `carriedForward` untouched — streak grows, reward diminishes (log2) | up to +0.4 |

A diagram can carry more than one signal at once (e.g. rendered clean, then reworked two turns later); they're combined (`Σ reward × confidence`, clamped to [−1, 1]) before being applied to a turn's reward — see `exportFeedback` in `server/src/controllers/feedbackController.ts`.

Every generation run also logs its trajectory into MongoDB:
- System and user prompts
- Model reasoning and completions
- Output schemas and latency metrics

To export the training set:
```bash
curl -X GET "http://localhost:5001/api/feedback/export" -o rl_training_data.jsonl
```

The resulting `rl_training_data.jsonl` is ready to be consumed directly by RL fine-tuning trainers (DPO, PPO, GRPO, or LangChain ART).

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
