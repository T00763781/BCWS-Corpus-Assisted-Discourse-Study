import { loadDotEnv, getConfig } from './lib/config.mjs';
import { createDbPool, runSchemaMigration } from './lib/db.mjs';

async function run() {
  await loadDotEnv();
  const cfg = getConfig();
  const pool = createDbPool(cfg.databaseUrl);
  try {
    await runSchemaMigration(pool);
    console.log('Database schema is up to date.');
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error(`[fatal] ${err.message || err}`);
  process.exitCode = 1;
});
