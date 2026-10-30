import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { api } from './api.js';
import { initDb, closeDb } from './db.js';
import { seedIfEmpty, seedUsers } from './seed.js';

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.use('/api', api);

const publicDir = path.join(config.rootDir, 'public');
app.use(express.static(publicDir, { index: 'index.html' }));
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

async function main() {
  await initDb();
  await seedUsers();
  await seedIfEmpty();

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`\n  Kan is running → http://localhost:${config.port}`);
    console.log('  First run? Sign in with the bootstrap admin account.\n');
  });

  const shutdown = async (signal) => {
    console.log(`[server] ${signal} received, shutting down…`);
    server.close(async () => {
      try {
        await closeDb();
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
