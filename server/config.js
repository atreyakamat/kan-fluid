import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

function int(value, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

const text = (value, fallback) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || fallback;
};

export const config = {
  rootDir,
  port: int(process.env.PORT, 3000),
  sessionSecret: process.env.SESSION_SECRET || 'insecure-development-secret',
  sessionDays: int(process.env.SESSION_DAYS, 7),
  initialAdmin: {
    username: text(process.env.INITIAL_ADMIN_USERNAME, 'admin').toLowerCase(),
    password: process.env.INITIAL_ADMIN_PASSWORD || 'admin',
    name: text(process.env.INITIAL_ADMIN_NAME, 'Admin'),
  },
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: int(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'kan',
    password: process.env.DB_PASSWORD || 'kan_secret',
    database: process.env.DB_NAME || 'kan',
  },
};

if (config.sessionSecret === 'insecure-development-secret') {
  console.warn('[config] SESSION_SECRET is not set — using an insecure default.');
}
