import path from 'node:path';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Environment is parsed once, at boot, and the process refuses to start on a bad
 * value. A missing GROQ_API_KEY must fail here rather than on the first user
 * request, half way through a run that has already written documents to Mongo.
 */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  MODEL_PRIMARY: z.string().default('openai/gpt-oss-120b'),
  MODEL_FAST: z.string().default('openai/gpt-oss-20b'),
  LLM_CONCURRENCY: z.coerce.number().int().positive().default(4),
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).default(4),

  PLANTUML_BACKEND: z.enum(['jar', 'server']).default('jar'),
  PLANTUML_JAR: z.string().default('vendor/plantuml.jar'),
  PLANTUML_SERVER_URL: z.string().default('http://localhost:8080'),
  JAVA_BIN: z.string().default('java'),
  JAVA_MAX_HEAP: z.string().default('512m'),
  PLANTUML_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  OUTPUT_DIR: z.string().default('output'),
  DIAGRAM_CONCURRENCY: z.coerce.number().int().positive().default(4),
  DIAGRAM_STRATEGY: z.enum(['projector', 'llm']).default('projector'),
  MAX_REPAIR_ATTEMPTS: z.coerce.number().int().min(0).default(2),
  MAX_CSM_REPAIR_ATTEMPTS: z.coerce.number().int().min(0).default(2),
});

export type Env = z.infer<typeof EnvSchema> & {
  /** Absolute path to the rendered-diagram output root. */
  outputRoot: string;
  /** Absolute path to plantuml.jar. */
  jarPath: string;
};

function load(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}\n\nSee server/.env.example.`);
  }
  const cwd = process.cwd();
  return {
    ...parsed.data,
    outputRoot: path.resolve(cwd, parsed.data.OUTPUT_DIR),
    jarPath: path.resolve(cwd, parsed.data.PLANTUML_JAR),
  };
}

let cached: Env | null = null;

/** Lazily parsed so that unit tests can import modules without a full .env. */
export function env(): Env {
  if (!cached) cached = load();
  return cached;
}

/** Test seam: override configuration without touching process.env. */
export function setEnvForTesting(overrides: Partial<Env>): void {
  cached = { ...env(), ...overrides };
}
