import type { Csm } from '../../src/agent/schemas/csm.js';

/**
 * A realistic CSM for the SEBI compliance-monitoring system from the brief.
 *
 * This is the reference input for the projector snapshot suite: it exercises
 * every slice, including the awkward ones — a decision with two branches, a
 * fork/join pair, a state machine with a terminal transition, PII attributes,
 * and cross-package dependencies.
 */
export const SEBI_CSM: Csm = {
  meta: {
    name: 'SEBI Compliance Monitor',
    oneLiner: 'Ingests SEBI circulars, extracts obligations, and reports gaps and impact against the firm\'s controls.',
    domain: 'regulatory compliance',
    assumptions: [
      'SEBI circulars are available as PDFs from a public listing page',
      'The existing control library is already catalogued in an internal system',
    ],
    openQuestions: ['Should superseded circulars be re-analysed automatically?'],
  },
  actors: [
    { id: 'compliance-officer', name: 'Compliance Officer', kind: 'human', goals: ['Review new obligations', 'Sign off gap analysis'] },
    { id: 'sebi-portal', name: 'SEBI Portal', kind: 'external_system', goals: ['Publish circulars'] },
    { id: 'nightly-scheduler', name: 'Nightly Scheduler', kind: 'scheduler', goals: ['Trigger ingestion runs'] },
  ],
  components: [
    { id: 'circular-fetcher', name: 'Circular Fetcher', kind: 'job', responsibilities: ['Poll the SEBI listing page', 'Download new circular PDFs'], provides: ['ifetch'], requires: [], packageId: 'pkg-ingest' },
    { id: 'clause-parser', name: 'Clause Parser', kind: 'service', responsibilities: ['Segment circulars into clauses', 'Normalise clause numbering', 'Emit a clause table'], provides: ['iparse'], requires: ['ifetch'], packageId: 'pkg-ingest' },
    { id: 'requirement-extractor', name: 'Requirement Extractor', kind: 'service', responsibilities: ['Classify clauses as obligations', 'Extract deadlines and applicability'], provides: ['iextract'], requires: ['iparse'], packageId: 'pkg-analysis' },
    { id: 'gap-analyser', name: 'Gap Analyser', kind: 'service', responsibilities: ['Match obligations to existing controls', 'Score residual gaps'], provides: ['igap'], requires: ['iextract', 'icontrols'], packageId: 'pkg-analysis' },
    { id: 'impact-assessor', name: 'Impact Assessor', kind: 'service', responsibilities: ['Estimate IT change effort', 'Estimate operational change effort'], provides: ['iimpact'], requires: ['iextract'], packageId: 'pkg-analysis' },
    { id: 'control-library', name: 'Control Library', kind: 'external', responsibilities: ['Hold the firm\'s existing controls'], provides: ['icontrols'], requires: [], packageId: null },
    { id: 'compliance-db', name: 'Compliance Store', kind: 'db', responsibilities: ['Persist circulars, clauses, obligations and findings'], provides: ['istore'], requires: [], packageId: 'pkg-platform' },
    { id: 'review-ui', name: 'Review Console', kind: 'ui', responsibilities: ['Present findings for sign-off'], provides: [], requires: ['igap', 'iimpact'], packageId: 'pkg-platform' },
    { id: 'ingest-queue', name: 'Ingestion Queue', kind: 'queue', responsibilities: ['Buffer circulars awaiting parsing'], provides: [], requires: [], packageId: 'pkg-platform' },
  ],
  interfaces: [
    { id: 'ifetch', name: 'ICircularSource', providerId: 'circular-fetcher', operations: [{ name: 'listNew', input: 'since: date', output: 'CircularRef[]', sync: true }] },
    { id: 'iparse', name: 'IClauseTable', providerId: 'clause-parser', operations: [{ name: 'parse', input: 'CircularRef', output: 'Clause[]', sync: true }] },
    { id: 'iextract', name: 'IObligations', providerId: 'requirement-extractor', operations: [{ name: 'extract', input: 'Clause[]', output: 'Obligation[]', sync: true }] },
    { id: 'igap', name: 'IGapAnalysis', providerId: 'gap-analyser', operations: [{ name: 'analyse', input: 'Obligation[]', output: 'Gap[]', sync: false }] },
    { id: 'iimpact', name: 'IImpactAssessment', providerId: 'impact-assessor', operations: [{ name: 'assess', input: 'Obligation[]', output: 'Impact[]', sync: false }] },
    { id: 'icontrols', name: 'IControlLibrary', providerId: 'control-library', operations: [{ name: 'listControls', input: 'scope: string', output: 'Control[]', sync: true }] },
    { id: 'istore', name: 'IComplianceStore', providerId: 'compliance-db', operations: [{ name: 'save', input: 'Entity', output: 'void', sync: true }] },
  ],
  entities: [
    { id: 'circular', name: 'Circular', attributes: [{ name: 'id', type: 'string', pii: false }, { name: 'reference', type: 'string', pii: false }, { name: 'publishedAt', type: 'date', pii: false }, { name: 'sourceUrl', type: 'string', pii: false }], relations: [{ toId: 'clause', kind: 'one-to-many', label: 'contains' }] },
    { id: 'clause', name: 'Clause', attributes: [{ name: 'number', type: 'string', pii: false }, { name: 'text', type: 'string', pii: false }], relations: [{ toId: 'obligation', kind: 'one-to-many', label: 'yields' }] },
    { id: 'obligation', name: 'Obligation', attributes: [{ name: 'summary', type: 'string', pii: false }, { name: 'deadline', type: 'date', pii: false }, { name: 'applicability', type: 'string', pii: false }], relations: [{ toId: 'gap', kind: 'one-to-many', label: 'assessed by' }] },
    { id: 'control', name: 'Control', attributes: [{ name: 'name', type: 'string', pii: false }, { name: 'owner', type: 'string', pii: true }], relations: [] },
    { id: 'gap', name: 'Gap', attributes: [{ name: 'severity', type: 'string', pii: false }, { name: 'rationale', type: 'string', pii: false }], relations: [{ toId: 'control', kind: 'one-to-one', label: 'against' }] },
    { id: 'impact', name: 'ImpactAssessment', attributes: [{ name: 'itEffortDays', type: 'int', pii: false }, { name: 'opsEffortDays', type: 'int', pii: false }], relations: [{ toId: 'obligation', kind: 'one-to-one', label: 'for' }] },
  ],
  useCases: [
    { id: 'uc-ingest', name: 'Ingest latest circulars', actorIds: ['nightly-scheduler', 'sebi-portal'], includes: [], extends: [] },
    { id: 'uc-review', name: 'Review new obligations', actorIds: ['compliance-officer'], includes: ['uc-gap'], extends: [] },
    { id: 'uc-gap', name: 'Run gap analysis', actorIds: ['compliance-officer'], includes: [], extends: [] },
    { id: 'uc-impact', name: 'Assess IT and operational impact', actorIds: ['compliance-officer'], includes: [], extends: ['uc-gap'] },
  ],
  flows: [
    {
      id: 'flow-ingest',
      name: 'Nightly circular ingestion and analysis',
      trigger: 'Nightly schedule at 02:00 IST',
      participants: ['nightly-scheduler', 'circular-fetcher', 'sebi-portal', 'ingest-queue', 'clause-parser', 'requirement-extractor', 'gap-analyser', 'compliance-db', 'compliance-officer'],
      steps: [
        { fromId: 'nightly-scheduler', toId: 'circular-fetcher', message: 'run ingestion', kind: 'sync', condition: null, group: null },
        { fromId: 'circular-fetcher', toId: 'sebi-portal', message: 'GET /circulars?since=lastRun', kind: 'sync', condition: null, group: null },
        { fromId: 'sebi-portal', toId: 'circular-fetcher', message: 'circular list + PDFs', kind: 'return', condition: null, group: null },
        { fromId: 'circular-fetcher', toId: 'ingest-queue', message: 'enqueue circular', kind: 'async', condition: 'for each new circular', group: 'loop' },
        { fromId: 'ingest-queue', toId: 'clause-parser', message: 'deliver circular', kind: 'async', condition: 'for each new circular', group: 'loop' },
        { fromId: 'clause-parser', toId: 'compliance-db', message: 'save clause table', kind: 'sync', condition: null, group: null },
        { fromId: 'clause-parser', toId: 'requirement-extractor', message: 'extract obligations', kind: 'sync', condition: null, group: null },
        { fromId: 'requirement-extractor', toId: 'gap-analyser', message: 'analyse gaps', kind: 'sync', condition: 'obligations found', group: 'alt' },
        { fromId: 'gap-analyser', toId: 'compliance-db', message: 'save findings', kind: 'sync', condition: 'obligations found', group: 'alt' },
        { fromId: 'gap-analyser', toId: 'compliance-officer', message: 'notify: findings ready for review', kind: 'async', condition: null, group: null },
      ],
      errorPaths: [
        { when: 'SEBI portal unreachable', handledBy: 'circular-fetcher', action: 'retry with backoff, alert on 3rd failure' },
        { when: 'PDF fails to parse', handledBy: 'clause-parser', action: 'quarantine circular for manual review' },
      ],
    },
  ],
  processes: [
    {
      id: 'proc-analysis',
      name: 'Circular analysis pipeline',
      lanes: [
        { id: 'lane-ingest', name: 'Ingestion' },
        { id: 'lane-analysis', name: 'Analysis' },
        { id: 'lane-review', name: 'Review' },
      ],
      activities: [
        { id: 'a-start', name: 'start', laneId: 'lane-ingest', type: 'start' },
        { id: 'a-fetch', name: 'Fetch new circulars', laneId: 'lane-ingest', type: 'action' },
        { id: 'a-parse', name: 'Parse into clause table', laneId: 'lane-ingest', type: 'action' },
        { id: 'a-valid', name: 'Parsed successfully?', laneId: 'lane-ingest', type: 'decision' },
        { id: 'a-quarantine', name: 'Quarantine for manual review', laneId: 'lane-review', type: 'action' },
        { id: 'a-extract', name: 'Extract obligations', laneId: 'lane-analysis', type: 'action' },
        { id: 'a-fork', name: 'fork', laneId: 'lane-analysis', type: 'fork' },
        { id: 'a-gap', name: 'Run gap analysis', laneId: 'lane-analysis', type: 'action' },
        { id: 'a-impact', name: 'Assess IT and operational impact', laneId: 'lane-analysis', type: 'action' },
        { id: 'a-join', name: 'join', laneId: 'lane-analysis', type: 'join' },
        { id: 'a-report', name: 'Compile findings report', laneId: 'lane-analysis', type: 'action' },
        { id: 'a-signoff', name: 'Officer signs off', laneId: 'lane-review', type: 'action' },
        { id: 'a-end', name: 'end', laneId: 'lane-review', type: 'end' },
        { id: 'a-end-quarantine', name: 'end', laneId: 'lane-review', type: 'end' },
      ],
      transitions: [
        { fromId: 'a-start', toId: 'a-fetch', guard: null },
        { fromId: 'a-fetch', toId: 'a-parse', guard: null },
        { fromId: 'a-parse', toId: 'a-valid', guard: null },
        { fromId: 'a-valid', toId: 'a-extract', guard: 'yes' },
        { fromId: 'a-valid', toId: 'a-quarantine', guard: 'no' },
        { fromId: 'a-quarantine', toId: 'a-end-quarantine', guard: null },
        { fromId: 'a-extract', toId: 'a-fork', guard: null },
        { fromId: 'a-fork', toId: 'a-gap', guard: null },
        { fromId: 'a-fork', toId: 'a-impact', guard: null },
        { fromId: 'a-gap', toId: 'a-join', guard: null },
        { fromId: 'a-impact', toId: 'a-join', guard: null },
        { fromId: 'a-join', toId: 'a-report', guard: null },
        { fromId: 'a-report', toId: 'a-signoff', guard: null },
        { fromId: 'a-signoff', toId: 'a-end', guard: null },
      ],
    },
  ],
  stateMachines: [
    {
      id: 'sm-circular',
      subjectId: 'circular',
      states: [
        { id: 's-discovered', name: 'Discovered', entry: 'record source URL', exit: null },
        { id: 's-parsed', name: 'Parsed', entry: 'index clause table', exit: null },
        { id: 's-analysed', name: 'Analysed', entry: 'attach gap and impact findings', exit: null },
        { id: 's-quarantined', name: 'Quarantined', entry: 'raise manual-review task', exit: null },
        { id: 's-signed-off', name: 'Signed off', entry: 'stamp reviewer and timestamp', exit: null },
      ],
      transitions: [
        { fromId: '[*]', toId: 's-discovered', event: 'published by SEBI', guard: null, action: null },
        { fromId: 's-discovered', toId: 's-parsed', event: 'parse', guard: 'PDF readable', action: 'build clause table' },
        { fromId: 's-discovered', toId: 's-quarantined', event: 'parse', guard: 'PDF unreadable', action: 'notify operations' },
        { fromId: 's-parsed', toId: 's-analysed', event: 'analyse', guard: null, action: 'run gap and impact' },
        { fromId: 's-quarantined', toId: 's-parsed', event: 'manual fix', guard: null, action: null },
        { fromId: 's-analysed', toId: 's-signed-off', event: 'officer approves', guard: null, action: null },
        { fromId: 's-signed-off', toId: '[*]', event: 'archive', guard: null, action: null },
      ],
    },
  ],
  deployment: {
    nodes: [
      { id: 'n-ecs', name: 'ECS Fargate Cluster', kind: 'container', env: 'production' },
      { id: 'n-atlas', name: 'MongoDB Atlas', kind: 'cloud-service', env: 'ap-south-1' },
      { id: 'n-s3', name: 'S3 Document Bucket', kind: 'cloud-service', env: 'ap-south-1' },
      { id: 'n-workstation', name: 'Officer Workstation', kind: 'device', env: 'corporate LAN' },
    ],
    artifacts: [
      { id: 'art-ingest', name: 'ingest-service.jar', componentIds: ['circular-fetcher', 'clause-parser'] },
      { id: 'art-analysis', name: 'analysis-service.jar', componentIds: ['requirement-extractor', 'gap-analyser', 'impact-assessor'] },
      { id: 'art-db', name: 'compliance-db', componentIds: ['compliance-db'] },
      { id: 'art-ui', name: 'review-console.bundle', componentIds: ['review-ui'] },
    ],
    placements: [
      { artifactId: 'art-ingest', nodeId: 'n-ecs' },
      { artifactId: 'art-analysis', nodeId: 'n-ecs' },
      { artifactId: 'art-db', nodeId: 'n-atlas' },
      { artifactId: 'art-ui', nodeId: 'n-workstation' },
    ],
  },
  packages: [
    { id: 'pkg-ingest', name: 'Ingestion', containsComponentIds: ['circular-fetcher', 'clause-parser'], dependsOn: ['pkg-platform'] },
    { id: 'pkg-analysis', name: 'Analysis', containsComponentIds: ['requirement-extractor', 'gap-analyser', 'impact-assessor'], dependsOn: ['pkg-ingest', 'pkg-platform'] },
    { id: 'pkg-platform', name: 'Platform', containsComponentIds: ['compliance-db', 'review-ui', 'ingest-queue'], dependsOn: [] },
  ],
  timings: [
    {
      subjectId: 'circular',
      timeline: [
        { at: '0ms', state: 'Discovered' },
        { at: '900ms', state: 'Parsed' },
        { at: '4s', state: 'Analysed' },
        { at: '30s', state: 'Reported' },
      ],
      slas: [
        { name: 'Ingest to parsed', budgetMs: 2000 },
        { name: 'Parsed to analysed', budgetMs: 10000 },
        { name: 'End-to-end nightly run', budgetMs: 1800000 },
      ],
    },
  ],
  nfrs: [
    { category: 'auditability', statement: 'Every finding must trace back to a specific clause and circular version' },
    { category: 'security', statement: 'Control owner identities are PII and must be access-controlled' },
    { category: 'availability', statement: 'A failed nightly run must retry before 08:00 IST' },
    { category: 'performance', statement: 'A single circular must complete analysis within 10 seconds' },
  ],
};
