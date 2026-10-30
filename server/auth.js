import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';
import { pool } from './db.js';

const COOKIE_NAME = 'kan_session';
const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

/* ── Password hashing ────────────────────────────────────────────────────── */

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(String(password), salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, saltPart, hashPart] = stored.split('$');
  if (scheme !== 'scrypt' || !saltPart || !hashPart) return false;
  try {
    const salt = Buffer.from(saltPart, 'base64url');
    const expected = Buffer.from(hashPart, 'base64url');
    const derived = await scrypt(String(password), salt, expected.length || KEY_LENGTH);
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/* ── User lookups ─────────────────────────────────────────────────────────── */

export async function findUser(username) {
  const needle = String(username ?? '').trim().toLowerCase();
  if (!needle) return null;
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ? AND active = 1 LIMIT 1', [
    needle,
  ]);
  return rows[0] ?? null;
}

export async function findUserById(id) {
  const value = Number(id);
  if (!Number.isInteger(value) || value <= 0) return null;
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [value]);
  return rows[0] ?? null;
}

export async function verifyCredentials(username, password) {
  const user = await findUser(username);
  if (!user) {
    // Keep timing similar for unknown usernames.
    await verifyPassword(String(password ?? ''), `scrypt$${'A'.repeat(22)}$${'A'.repeat(86)}`);
    return null;
  }
  const ok = await verifyPassword(password, user.password_hash);
  return ok ? user : null;
}

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    mustChangePassword: !!user.must_change_password,
    onboarded: !!user.onboarded,
    tourCompleted: !!user.tour_completed,
    theme: user.theme === 'dark' ? 'dark' : 'light',
    createdAt: user.created_at,
  };
}

export function sessionUser(user) {
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

/* ── Session tokens ───────────────────────────────────────────────────────── */

function sign(value) {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
}

function encodeToken(user) {
  const payload = {
    uid: user.id,
    exp: Date.now() + config.sessionDays * 24 * 60 * 60 * 1000,
    v: Number(user.session_version ?? 0),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

async function decodeToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length) return null;
  if (!crypto.timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.uid || !payload?.exp || payload.exp < Date.now()) return null;
    const user = await findUserById(payload.uid);
    if (!user || !user.active) return null;
    if (Number(payload.v ?? 0) !== Number(user.session_version ?? 0)) return null;
    return user;
  } catch {
    return null;
  }
}

export function readCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function setSessionCookie(res, user) {
  const maxAge = config.sessionDays * 24 * 60 * 60;
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeToken(user)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`,
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export async function currentUser(req) {
  return decodeToken(readCookies(req)[COOKIE_NAME]);
}

export async function requireAuth(req, res, next) {
  try {
    const user = await currentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Blocks every data endpoint until a temporary password has been replaced.
 * The client receives a stable code so it can open the change-password dialog.
 */
export function requireReady(req, res, next) {
  if (req.user?.must_change_password) {
    res.status(428).json({
      error: 'Set a new password before continuing',
      code: 'password_change_required',
    });
    return;
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'You do not have permission to do that' });
      return;
    }
    next();
  };
}

export const COOKIE = COOKIE_NAME;
