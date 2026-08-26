import { createApp } from './app.js';
import connectDB from './config/db.js';
import { env } from './config/env.js';
import { getBackend } from './plantuml/index.js';

// Parsed before anything else, so a bad or missing value stops the process at
// boot rather than surfacing as a 500 on the first real request.
const config = env();

async function start(): Promise<void> {
  await connectDB();

  if (!(await getBackend().available())) {
    console.warn(
      `WARNING: the ${getBackend().name} PlantUML backend is not available. ` +
        'Diagrams will be generated but not rendered. ' +
        (config.PLANTUML_BACKEND === 'jar'
          ? `Check that ${config.JAVA_BIN} runs and ${config.jarPath} exists (npm run fetch:plantuml).`
          : `Check that ${config.PLANTUML_SERVER_URL} is reachable.`),
    );
  }

  createApp().listen(config.PORT, () => {
    console.log(`Server running on http://localhost:${config.PORT}`);
  });
}

start().catch((error: unknown) => {
  console.error('Failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
