import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { setEnvForTesting } from '../src/config/env.js';
import { setClientForTesting } from '../src/agent/llm/groq.js';
import { sharedBudget } from '../src/agent/llm/tokenBudget.js';
import { setBackend } from '../src/plantuml/index.js';
import { createFakeGroq } from './helpers/fakeGroq.js';
import { FakePlantUmlBackend } from './helpers/fakePlantuml.js';

const MONGO_URI = process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017/umlgenerator_test';
const SESSION = 'route-test-session';

const BRIEF =
  'I am working on a compliance monitoring solution which will pull in the latest circulars from SEBI ' +
  'and parse them into a table of clauses.';

async function mongoReachable(): Promise<boolean> {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 1500 });
    return true;
  } catch {
    return false;
  }
}

const hasMongo = await mongoReachable();

/**
 * The full HTTP surface, end to end, with the LLM and the renderer stubbed.
 *
 * Everything else is real: the same routes, the same pipeline, the same zod
 * schemas validating every model response, the same mongo writes. What this
 * proves is that a generate turn, a revision, a view switch and a feedback
 * export actually compose — which no unit test can show.
 */
describe.skipIf(!hasMongo)('API routes', () => {
  let server: Server;
  let baseUrl: string;
  let outputRoot: string;
  const plantuml = new FakePlantUmlBackend();
  const groq = createFakeGroq();

  const get = (url: string, init?: RequestInit) => fetch(`${baseUrl}${url}`, init);
  const post = (url: string, body: unknown, init: RequestInit = {}) =>
    fetch(`${baseUrl}${url}`, {
      ...init,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      body: JSON.stringify(body),
    });

  beforeAll(async () => {
    outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'umlgen-test-'));
    setEnvForTesting({ outputRoot });
    setClientForTesting(groq.client);
    setBackend(plantuml);
    // The real budget paces calls against Groq's 8k tokens/minute, which is
    // right in production and pure sleeping here — the fake client has no quota.
    sharedBudget.setLimit(100_000_000);

    await mongoose.connection.dropDatabase();

    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });

  afterAll(async () => {
    setClientForTesting(null);
    setBackend(null);
    sharedBudget.reset();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await fs.rm(outputRoot, { recursive: true, force: true });
  });

  let diagramId = '';
  let pngUrl = '';

  it('serves the diagram catalogue the client depends on', async () => {
    const res = await get('/api/diagram-types');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.total).toBe(14);
    expect(body.categories.structure.count).toBe(7);
    expect(body.categories.interaction.count).toBe(4);
  });

  it('generates diagrams for a new session', async () => {
    const res = await post(`/api/diagrams/generate/${SESSION}`, {
      prompt: BRIEF,
      diagram_types: ['sequential', 'component', 'class'],
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.mode).toBe('generate');
    expect(body.version).toBe(1);
    // "sequential" is not a UML type; the brief uses it, so it must resolve.
    expect(body.diagramTypes).toEqual(['sequence', 'component', 'class']);
    expect(body.diagrams).toHaveLength(3);

    for (const diagram of body.diagrams) {
      expect(diagram.valid).toBe(true);
      expect(diagram.source.startsWith('@startuml')).toBe(true);
      expect(diagram.svg).toContain('<svg');
      expect(diagram.pngUrl).toMatch(/^\/api\/diagram\//);
    }

    expect(body.integrity.ok).toBe(true);
    expect(body.usage.llmCalls).toBeGreaterThan(0);

    diagramId = body.diagrams[0].diagramId;
    pngUrl = body.diagrams[0].pngUrl;
  });

  it('reports an unknown diagram type instead of guessing', async () => {
    const res = await post('/api/diagrams/generate/unknown-types-session', {
      prompt: BRIEF,
      diagram_types: ['definitely-not-a-diagram'],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain('definitely-not-a-diagram');
  });

  it('serves the rendered PNG', async () => {
    const res = await get(pngUrl);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
  });

  it('refuses to walk out of the output directory', async () => {
    const res = await get('/api/diagram/..%2F..%2F.env/x.png');
    expect(res.status).toBe(400);
  });

  it('switches to a view the stored model already covers without calling the LLM', async () => {
    // 'sequence' was generated, so `flows` is populated and nothing is missing.
    const before = groq.calls.length;
    const res = await post(`/api/diagrams/switch-view/${SESSION}`, { diagram_type: 'communication' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.llmCalls).toBe(0);
    expect(groq.calls.length).toBe(before);
    expect(body.diagram.type).toBe('communication');
    expect(body.diagram.valid).toBe(true);
  });

  it('fills the missing slice when a view needs one nobody has asked for', async () => {
    // No use cases were modelled, so this view costs exactly one call.
    const res = await post(`/api/diagrams/switch-view/${SESSION}`, { diagram_type: 'use-case' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.llmCalls).toBe(1);
    expect(body.diagram.type).toBe('use-case');
  });

  it('revises an existing session by patching the model', async () => {
    const res = await post(`/api/diagrams/generate/${SESSION}`, {
      prompt: 'Add a compliance reviewer who approves the gap analysis before it is published',
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.mode).toBe('revise');
    expect(body.version).toBe(2);
    expect(body.rationale).toBeTruthy();
    expect(body.changedSlices).toContain('actors');

    // The revision touched only `actors`; diagrams that do not read it are reused.
    const untouched = body.diagrams.filter((d: { carriedForward: boolean }) => d.carriedForward);
    expect(untouched.length).toBeGreaterThan(0);

    const model = await get(`/api/sessions/${SESSION}/model`);
    const stored = await model.json();
    expect(stored.csm.actors.map((a: { id: string }) => a.id)).toContain('compliance-reviewer');
  });

  it('streams progress over SSE', async () => {
    const res = await post(
      '/api/diagrams/generate/sse-session',
      { prompt: BRIEF, diagram_types: ['class'] },
      { headers: { Accept: 'text/event-stream' } },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const text = await res.text();
    expect(text).toContain('event: phase');
    expect(text).toContain('event: diagram');
    expect(text).toContain('event: done');

    // The source must arrive before the render finishes — that is the point.
    const firstDiagram = text.indexOf('event: diagram');
    expect(text.slice(firstDiagram, firstDiagram + 400)).toContain('@startuml');
  });

  it('lists the current diagrams for a session', async () => {
    const res = await get(`/api/diagrams/${SESSION}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.version).toBe(2);
    expect(body.diagrams.length).toBeGreaterThanOrEqual(3);
  });

  it('lists a past version when one is asked for', async () => {
    const res = await get(`/api/diagrams/${SESSION}?version=1`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.version).toBe(1);
    expect(body.diagrams.length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to the current version when the query is nonsense', async () => {
    const body = await (await get(`/api/diagrams/${SESSION}?version=banana`)).json();
    expect(body.version).toBe(2);
  });

  it('lists the sessions it still holds', async () => {
    const res = await get('/api/sessions');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    const found = body.sessions.find((s: { sessionId: string }) => s.sessionId === SESSION);
    expect(found).toBeDefined();
    expect(found.currentVersion).toBe(2);
    expect(found.turnCount).toBe(2);
    // The title is the first prompt, not the revision that followed it.
    expect(BRIEF.startsWith(found.title.replace(/…$/, ''))).toBe(true);
  });

  it('returns the session history', async () => {
    const res = await get(`/api/sessions/${SESSION}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.turns).toHaveLength(2);
    expect(body.turns[0].kind).toBe('generate');
    expect(body.turns[1].kind).toBe('revise');
  });

  it('404s an unknown session rather than 500ing', async () => {
    expect((await get('/api/sessions/no-such-session')).status).toBe(404);
    expect((await post('/api/diagrams/switch-view/no-such-session', { diagram_type: 'class' })).status).toBe(
      404,
    );
  });

  it('exports automatically-captured signals as ART-shaped JSONL', async () => {
    // No rating was ever submitted — every diagram rendered at least once
    // above, which is enough on its own: render-quality is unconditional.
    // (The fake PlantUML backend always validates on the first try, so no
    // repair call — the one LLM call tagged with a specific diagramType —
    // ever runs; every exported line here is a turn-mean over shared calls.)
    const exported = await get(`/api/feedback/export?sessionId=${SESSION}`);
    expect(exported.status).toBe(200);

    const lines = (await exported.text()).trim().split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);

    const parsed = lines.map((l) => JSON.parse(l));
    const first = parsed[0]!;
    expect(Array.isArray(first.messages)).toBe(true);
    expect(first.messages[0].role).toBe('system');
    expect(typeof first.completion).toBe('string');
    expect(typeof first.reward).toBe('number');
    // render-quality alone is a mild positive (+0.1 * 0.3 confidence) on a
    // clean render, so a turn where nothing needed repair skews positive.
    expect(first.reward).toBeGreaterThan(0);
    expect(first.metadata.sessionId).toBe(SESSION);
    expect(first.metadata.step).toBeTruthy();
    expect(first.metadata.rewardBasis).toBe('turn-mean');
  });

  it('no longer exposes a feedback submission endpoint — behavior is the feedback', async () => {
    expect((await post('/api/feedback', { sessionId: SESSION, diagramId, rating: 'up' })).status).toBe(404);
    expect((await get(`/api/feedback?sessionId=${SESSION}`)).status).toBe(404);
  });

  it('clears working state but keeps the training data', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/${SESSION}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect((await res.json()).deleted.thread).toBe(1);

    expect((await get(`/api/sessions/${SESSION}`)).status).toBe(404);

    const exported = await get(`/api/feedback/export?sessionId=${SESSION}`);
    expect((await exported.text()).trim().split('\n').filter(Boolean).length).toBeGreaterThan(0);
  });

  describe('User Identification & Scoped Sessions', () => {
    it('creates a new user when name does not exist', async () => {
      const res = await post('/api/users/identify', { name: 'Tony' });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.isNewUser).toBe(true);
      expect(data.user.name).toBe('Tony');
      expect(data.user.userId).toBe('usr_tony');
    });

    it('recognizes an existing user with case-insensitive name matching', async () => {
      const res = await post('/api/users/identify', { name: 'tony' });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.isNewUser).toBe(false);
      expect(data.user.name).toBe('Tony');
      expect(data.user.userId).toBe('usr_tony');
    });

    it('lists known users in the system', async () => {
      const res = await get('/api/users');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.total).toBeGreaterThanOrEqual(1);
      expect(data.users.some((u: { userId: string }) => u.userId === 'usr_tony')).toBe(true);
    });

    it('filters sessions by userId', async () => {
      const tonySession = 'tony-session-1';
      const aliceSession = 'alice-session-1';

      // Create a session for Tony
      await post(`/api/diagrams/generate/${tonySession}`, {
        prompt: 'Tony banking app design',
        diagram_types: ['class'],
        userId: 'usr_tony',
      });

      // Create a session for Alice
      await post(`/api/diagrams/generate/${aliceSession}`, {
        prompt: 'Alice e-commerce app design',
        diagram_types: ['class'],
        userId: 'usr_alice',
      });

      // Query Tony's sessions
      const tonyRes = await get('/api/sessions?userId=usr_tony');
      const tonyData = await tonyRes.json();
      expect(tonyData.sessions.some((s: { sessionId: string }) => s.sessionId === tonySession)).toBe(true);
      expect(tonyData.sessions.some((s: { sessionId: string }) => s.sessionId === aliceSession)).toBe(false);

      // Query Alice's sessions
      const aliceRes = await get('/api/sessions?userId=usr_alice');
      const aliceData = await aliceRes.json();
      expect(aliceData.sessions.some((s: { sessionId: string }) => s.sessionId === aliceSession)).toBe(true);
      expect(aliceData.sessions.some((s: { sessionId: string }) => s.sessionId === tonySession)).toBe(false);
    });
  });
});

