import express from 'express';
import {
  requireAuth,
  requireReady,
  requireRole,
  verifyCredentials,
  verifyPassword,
  hashPassword,
  findUserById,
  setSessionCookie,
  clearSessionCookie,
  publicUser,
} from './auth.js';
import { pool } from './db.js';
import { addClient, notify } from './events.js';

export const api = express.Router();

api.use(express.json({ limit: '1mb' }));

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
const priorityLabel = (value) => PRIORITY_LABELS[value] ?? 'Medium';
const ROLES = ['Owner', 'Admin', 'Member'];
const MANAGERS = ['Owner', 'Admin'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const fail = (status, message) => {
  throw new HttpError(status, message);
};

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const clean = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const multiline = (value, max) =>
  typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, max) : '';

const isColor = (value) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

const colorOf = (value, fallback = '#7c8cff') => (isColor(value) ? value.toLowerCase() : fallback);

const priorityOf = (value) => (PRIORITIES.includes(value) ? value : 'medium');

const idOf = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const dateOf = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, 'Invalid due date');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    fail(400, 'Invalid due date');
  }
  return value;
};

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const normalizeUsername = (value) => clean(value, 60).toLowerCase();

const isValidUsername = (value) => /^[a-z0-9][a-z0-9._-]{2,59}$/.test(value);

const passwordOf = (value, label = 'Password') => {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 8) fail(400, `${label} must be at least 8 characters`);
  if (password.length > 200) fail(400, `${label} is too long`);
  return password;
};

const isManager = (user) => !!user && MANAGERS.includes(user.role);
const isOwner = (user) => user?.role === 'Owner';

const toBoard = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description ?? '',
  accent: row.accent,
  position: row.position,
  cardCount: Number(row.card_count ?? 0),
  doneCount: Number(row.done_count ?? 0),
  createdAt: row.created_at,
});

const toColumn = (row) => ({
  id: row.id,
  boardId: row.board_id,
  name: row.name,
  color: row.color,
  position: row.position,
  wipLimit: row.wip_limit === null ? null : Number(row.wip_limit),
  isDone: !!row.is_done,
  createdAt: row.created_at,
});

const toCard = (row) => ({
  id: row.id,
  boardId: row.board_id,
  columnId: row.column_id,
  title: row.title,
  description: row.description ?? '',
  priority: row.priority,
  dueDate: row.due_date || null,
  assignee: row.assignee ?? '',
  createdBy: row.created_by ?? null,
  createdByName: row.created_by_name || '',
  position: row.position,
  archived: !!row.archived,
  commentCount: Number(row.comment_count ?? 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  labels: [],
});

const toActivity = (row) => ({
  id: row.id,
  boardId: row.board_id,
  cardId: row.card_id ?? null,
  cardTitle: row.card_title ?? '',
  userId: row.user_id ?? null,
  userName: row.user_name ?? '',
  type: row.type,
  detail: row.detail ?? '',
  fromValue: row.from_value ?? '',
  toValue: row.to_value ?? '',
  createdAt: row.created_at,
});

const publicLabel = (row) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  cardCount: Number(row.card_count ?? 0),
  createdAt: row.created_at,
});

const adminUser = (row) => ({
  ...publicUser(row),
  active: !!row.active,
  lastLoginAt: row.last_login_at || null,
});

const toComment = (row) => ({
  id: row.id,
  cardId: row.card_id,
  userId: row.user_id,
  authorName: row.author_name,
  body: row.body,
  createdAt: row.created_at,
});

async function getBoard(id) {
  const [rows] = await pool.query(
    `SELECT b.*,
            (SELECT COUNT(*) FROM cards c
              WHERE c.board_id = b.id AND c.archived = 0) AS card_count,
            (SELECT COUNT(*) FROM cards c
               JOIN board_columns col ON col.id = c.column_id
              WHERE c.board_id = b.id AND c.archived = 0 AND col.is_done = 1) AS done_count
       FROM boards b
      WHERE b.id = ?`,
    [id],
  );
  if (!rows.length) fail(404, 'Board not found');
  return rows[0];
}

async function getCard(id) {
  const [rows] = await pool.query('SELECT * FROM cards WHERE id = ?', [id]);
  if (!rows.length) fail(404, 'Card not found');
  return rows[0];
}

async function getColumn(id) {
  const [rows] = await pool.query('SELECT * FROM board_columns WHERE id = ?', [id]);
  if (!rows.length) fail(404, 'Column not found');
  return rows[0];
}

async function labelsFor() {
  const [rows] = await pool.query(
    `SELECT l.id, l.name, l.color, l.created_at,
            (SELECT COUNT(*) FROM card_labels cl
               JOIN cards c ON c.id = cl.card_id
              WHERE cl.label_id = l.id AND c.archived = 0) AS card_count
       FROM labels l
      ORDER BY l.name`,
  );
  return rows.map(publicLabel);
}

const boardChanged = (req, boardId) => notify(req, { scope: 'board', boardId });
const boardsChanged = (req, boardId) => notify(req, { scope: 'boards', boardId });
const labelsChanged = (req) => notify(req, { scope: 'labels' });

async function recordActivity(
  db,
  req,
  card,
  type,
  { detail = '', fromValue = '', toValue = '' } = {},
) {
  await db.query(
    `INSERT INTO card_activity
       (board_id, card_id, card_title, user_id, user_name, type, detail, from_value, to_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      card.board_id,
      card.id,
      card.title,
      req.user?.id ?? null,
      req.user?.name ?? 'System',
      type,
      detail,
      fromValue,
      toValue,
    ],
  );
}

/* ── Auth ──────────────────────────────────────────────────────────────────── */

const loginAttempts = new Map();
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000;

api.get(
  '/health',
  wrap(async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  }),
);

api.post(
  '/auth/login',
  wrap(async (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const key = `${req.ip}|${username}`;
    const now = Date.now();
    const record = loginAttempts.get(key);

    if (record?.lockedUntil && record.lockedUntil > now) {
      const minutes = Math.ceil((record.lockedUntil - now) / 60000);
      fail(429, `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    }

    const user = username ? await verifyCredentials(username, password) : null;
    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      const fails = (record?.fails ?? 0) + 1;
      loginAttempts.set(key, {
        fails,
        lockedUntil: fails >= MAX_FAILS ? now + LOCK_MS : 0,
      });
      if (loginAttempts.size > 500) {
        for (const [k, v] of loginAttempts) {
          if (!v.lockedUntil || v.lockedUntil < now) loginAttempts.delete(k);
        }
      }
      fail(401, 'Invalid username or password');
    }

    loginAttempts.delete(key);
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
    setSessionCookie(res, user);
    res.json({ user: publicUser(user) });
  }),
);

api.post('/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

api.get('/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

api.post(
  '/auth/password',
  requireAuth,
  wrap(async (req, res) => {
    const fresh = await findUserById(req.user.id);
    if (!fresh) fail(401, 'Not signed in');
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = passwordOf(req.body?.newPassword, 'New password');
    const valid = await verifyPassword(currentPassword, fresh.password_hash);
    if (!valid) fail(400, 'Your current password is not correct');
    if (currentPassword === newPassword) fail(400, 'Choose a password different from the temporary one');

    const passwordHash = await hashPassword(newPassword);
    await pool.query(
      `UPDATE users
          SET password_hash = ?, must_change_password = 0, session_version = session_version + 1
        WHERE id = ?`,
      [passwordHash, fresh.id],
    );
    const updated = await findUserById(fresh.id);
    setSessionCookie(res, updated);
    res.json({ user: publicUser(updated) });
  }),
);

api.patch(
  '/auth/me',
  requireAuth,
  wrap(async (req, res) => {
    const body = req.body ?? {};
    const sets = [];
    const params = [];

    if (has(body, 'name')) {
      const name = clean(body.name, 80);
      if (name.length < 2) fail(400, 'Your name must be at least 2 characters');
      sets.push('name = ?');
      params.push(name);
    }
    if (has(body, 'theme')) {
      if (!['light', 'dark'].includes(body.theme)) fail(400, 'Theme must be light or dark');
      sets.push('theme = ?');
      params.push(body.theme);
    }
    if (has(body, 'onboarded')) {
      sets.push('onboarded = ?');
      params.push(body.onboarded ? 1 : 0);
    }
    if (has(body, 'tourCompleted')) {
      sets.push('tour_completed = ?');
      params.push(body.tourCompleted ? 1 : 0);
    }
    if (sets.length) {
      params.push(req.user.id);
      await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    const updated = await findUserById(req.user.id);
    res.json({ user: publicUser(updated) });
  }),
);

/* ── Everything below requires a signed-in, ready account ─────────────────── */

api.use(requireAuth, requireReady);

api.get('/events', (req, res) => {
  addClient(req, res);
});

api.get(
  '/meta',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, username, name, role FROM users WHERE active = 1 ORDER BY name, id',
    );
    res.json({ users: rows, priorities: PRIORITIES });
  }),
);

/* ── Users (team) ─────────────────────────────────────────────────────────── */

api.get(
  '/users',
  wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM users ORDER BY active DESC, name, id');
    res.json({ users: rows.map(adminUser) });
  }),
);

api.post(
  '/users',
  requireRole(...MANAGERS),
  wrap(async (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const name = clean(req.body?.name, 80);
    const role = ROLES.includes(req.body?.role) ? req.body.role : 'Member';
    const password = passwordOf(req.body?.password, 'Temporary password');

    if (!isValidUsername(username)) {
      fail(400, 'Username must be 3–60 characters: letters, numbers, dots, dashes or underscores');
    }
    if (name.length < 2) fail(400, 'Name must be at least 2 characters');
    if (role === 'Owner' && !isOwner(req.user)) fail(403, 'Only an Owner can add another Owner');

    const passwordHash = await hashPassword(password);
    try {
      const [result] = await pool.query(
        `INSERT INTO users
           (username, name, role, password_hash, must_change_password, onboarded, tour_completed)
         VALUES (?, ?, ?, ?, 1, 0, 0)`,
        [username, name, role, passwordHash],
      );
      const row = await findUserById(result.insertId);
      notify(req, { scope: 'users' });
      res.status(201).json({ user: adminUser(row) });
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') fail(409, 'That username is already taken');
      throw err;
    }
  }),
);

api.patch(
  '/users/:id',
  requireRole(...MANAGERS),
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid user id');
    const target = await findUserById(id);
    if (!target) fail(404, 'User not found');
    if (target.role === 'Owner' && !isOwner(req.user)) {
      fail(403, 'Only an Owner can edit another Owner');
    }

    const body = req.body ?? {};
    const sets = [];
    const params = [];

    if (has(body, 'name')) {
      const name = clean(body.name, 80);
      if (name.length < 2) fail(400, 'Name must be at least 2 characters');
      sets.push('name = ?');
      params.push(name);
    }
    if (has(body, 'role')) {
      if (!ROLES.includes(body.role)) fail(400, 'Unknown role');
      if (body.role === 'Owner' && !isOwner(req.user)) fail(403, 'Only an Owner can grant Owner');
      if (target.role === 'Owner' && body.role !== 'Owner') {
        const [[owners]] = await pool.query(
          "SELECT COUNT(*) AS n FROM users WHERE role = 'Owner' AND active = 1",
        );
        if (owners.n <= 1) fail(400, 'There must always be at least one active Owner');
      }
      sets.push('role = ?');
      params.push(body.role);
    }
    if (has(body, 'active')) {
      const active = body.active ? 1 : 0;
      if (!active && target.id === req.user.id) fail(400, 'You cannot deactivate your own account');
      if (!active && target.role === 'Owner') {
        const [[owners]] = await pool.query(
          "SELECT COUNT(*) AS n FROM users WHERE role = 'Owner' AND active = 1",
        );
        if (owners.n <= 1) fail(400, 'There must always be at least one active Owner');
      }
      sets.push('active = ?');
      params.push(active);
      if (!active) sets.push('session_version = session_version + 1');
    }
    if (has(body, 'password')) {
      if (target.role === 'Owner' && !isOwner(req.user) && target.id !== req.user.id) {
        fail(403, 'Only an Owner can reset another Owner’s password');
      }
      const password = passwordOf(body.password, 'Temporary password');
      const passwordHash = await hashPassword(password);
      sets.push('password_hash = ?', 'must_change_password = 1', 'session_version = session_version + 1');
      params.push(passwordHash);
    }
    if (has(body, 'theme')) {
      if (!['light', 'dark'].includes(body.theme)) fail(400, 'Theme must be light or dark');
      sets.push('theme = ?');
      params.push(body.theme);
    }

    if (sets.length) {
      params.push(id);
      await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
      notify(req, { scope: 'users' });
    }
    const updated = await findUserById(id);
    res.json({ user: adminUser(updated) });
  }),
);

api.delete(
  '/users/:id',
  requireRole(...MANAGERS),
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid user id');
    if (id === req.user.id) fail(400, 'You cannot remove your own account');
    const target = await findUserById(id);
    if (!target) fail(404, 'User not found');
    if (target.role === 'Owner') {
      if (!isOwner(req.user)) fail(403, 'Only an Owner can remove another Owner');
      const [[owners]] = await pool.query(
        "SELECT COUNT(*) AS n FROM users WHERE role = 'Owner' AND active = 1",
      );
      if (owners.n <= 1) fail(400, 'There must always be at least one active Owner');
    }
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    notify(req, { scope: 'users' });
    res.json({ ok: true });
  }),
);

/* ── Boards ────────────────────────────────────────────────────────────────── */

api.get(
  '/boards',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT b.*,
              (SELECT COUNT(*) FROM cards c
                WHERE c.board_id = b.id AND c.archived = 0) AS card_count,
              (SELECT COUNT(*) FROM cards c
                 JOIN board_columns col ON col.id = c.column_id
                WHERE c.board_id = b.id AND c.archived = 0 AND col.is_done = 1) AS done_count
         FROM boards b
        ORDER BY b.position, b.id`,
    );
    res.json({ boards: rows.map(toBoard) });
  }),
);

api.post(
  '/boards',
  wrap(async (req, res) => {
    const name = clean(req.body?.name, 120);
    if (!name) fail(400, 'Board name is required');
    const description = clean(req.body?.description, 255);
    const accent = colorOf(req.body?.accent);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[max]] = await conn.query('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM boards');
      const [result] = await conn.query(
        'INSERT INTO boards (name, description, accent, position) VALUES (?, ?, ?, ?)',
        [name, description, accent, max.p],
      );
      const defaults = [
        ['Backlog', '#94a3b8', 0],
        ['In Progress', '#7c8cff', 0],
        ['Done', '#34d399', 1],
      ];
      for (let i = 0; i < defaults.length; i += 1) {
        const [columnName, color, isDone] = defaults[i];
        await conn.query(
          'INSERT INTO board_columns (board_id, name, color, position, is_done) VALUES (?, ?, ?, ?, ?)',
          [result.insertId, columnName, color, i, isDone],
        );
      }
      await conn.commit();
      const [rows] = await pool.query(
        `SELECT b.*, 0 AS card_count, 0 AS done_count FROM boards b WHERE b.id = ?`,
        [result.insertId],
      );
      boardsChanged(req, result.insertId);
      res.status(201).json({ board: toBoard(rows[0]) });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }),
);

api.post(
  '/boards/:id/duplicate',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid board id');
    const source = await getBoard(id);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[max]] = await conn.query('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM boards');
      const name = clean(req.body?.name, 120) || `${source.name} copy`.slice(0, 120);
      const [boardResult] = await conn.query(
        'INSERT INTO boards (name, description, accent, position) VALUES (?, ?, ?, ?)',
        [name, source.description, source.accent, max.p],
      );
      const newBoardId = boardResult.insertId;

      const [columns] = await conn.query(
        'SELECT * FROM board_columns WHERE board_id = ? ORDER BY position, id',
        [id],
      );
      const columnMap = new Map();
      for (const column of columns) {
        const [result] = await conn.query(
          `INSERT INTO board_columns (board_id, name, color, position, wip_limit, is_done)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newBoardId, column.name, column.color, column.position, column.wip_limit, column.is_done],
        );
        columnMap.set(column.id, result.insertId);
      }

      const [cards] = await conn.query('SELECT * FROM cards WHERE board_id = ? ORDER BY position, id', [
        id,
      ]);
      for (const card of cards) {
        const columnId = columnMap.get(card.column_id);
        if (!columnId) continue;
        const [result] = await conn.query(
          `INSERT INTO cards
             (board_id, column_id, title, description, priority, due_date, assignee,
              created_by, created_by_name, position, archived)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newBoardId,
            columnId,
            card.title,
            card.description,
            card.priority,
            card.due_date,
            card.assignee,
            card.created_by ?? null,
            card.created_by_name ?? '',
            card.position,
            card.archived,
          ],
        );
        const [links] = await conn.query('SELECT label_id FROM card_labels WHERE card_id = ?', [
          card.id,
        ]);
        for (const link of links) {
          await conn.query('INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)', [
            result.insertId,
            link.label_id,
          ]);
        }
      }
      await conn.commit();
      const [rows] = await pool.query(
        `SELECT b.*,
                (SELECT COUNT(*) FROM cards c WHERE c.board_id = b.id AND c.archived = 0) AS card_count,
                (SELECT COUNT(*) FROM cards c JOIN board_columns col ON col.id = c.column_id
                  WHERE c.board_id = b.id AND c.archived = 0 AND col.is_done = 1) AS done_count
           FROM boards b WHERE b.id = ?`,
        [newBoardId],
      );
      boardsChanged(req, newBoardId);
      res.status(201).json({ board: toBoard(rows[0]) });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }),
);

api.patch(
  '/boards/:id',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid board id');
    await getBoard(id);
    const body = req.body ?? {};
    const sets = [];
    const params = [];
    if (has(body, 'name')) {
      const name = clean(body.name, 120);
      if (!name) fail(400, 'Board name is required');
      sets.push('name = ?');
      params.push(name);
    }
    if (has(body, 'description')) {
      sets.push('description = ?');
      params.push(clean(body.description, 255));
    }
    if (has(body, 'accent')) {
      sets.push('accent = ?');
      params.push(colorOf(body.accent, '#7c8cff'));
    }
    if (sets.length) {
      params.push(id);
      await pool.query(`UPDATE boards SET ${sets.join(', ')} WHERE id = ?`, params);
      boardsChanged(req, id);
    }
    const board = await getBoard(id);
    res.json({ board: toBoard(board) });
  }),
);

api.delete(
  '/boards/:id',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid board id');
    const [result] = await pool.query('DELETE FROM boards WHERE id = ?', [id]);
    if (!result.affectedRows) fail(404, 'Board not found');
    boardsChanged(req, id);
    res.json({ ok: true });
  }),
);

api.get(
  '/boards/:id',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid board id');
    const board = await getBoard(id);
    const [columnRows] = await pool.query(
      'SELECT * FROM board_columns WHERE board_id = ? ORDER BY position, id',
      [id],
    );
    const [cardRows] = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM comments cm WHERE cm.card_id = c.id) AS comment_count
         FROM cards c
        WHERE c.board_id = ?
        ORDER BY c.position, c.id`,
      [id],
    );
    const [linkRows] = await pool.query(
      `SELECT cl.card_id, l.id, l.name, l.color
         FROM card_labels cl
         JOIN labels l ON l.id = cl.label_id
         JOIN cards c ON c.id = cl.card_id
        WHERE c.board_id = ?`,
      [id],
    );
    const [activityRows] = await pool.query(
      `SELECT * FROM card_activity
        WHERE board_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 2000`,
      [id],
    );

    const cards = cardRows.map(toCard);
    const byId = new Map(cards.map((card) => [card.id, card]));
    for (const link of linkRows) {
      const card = byId.get(link.card_id);
      if (card) card.labels.push({ id: link.id, name: link.name, color: link.color });
    }

    res.json({
      board: toBoard(board),
      columns: columnRows.map(toColumn),
      cards,
      labels: await labelsFor(id),
      activity: activityRows.map(toActivity),
    });
  }),
);

/* ── Columns ───────────────────────────────────────────────────────────────── */

api.post(
  '/boards/:id/columns',
  wrap(async (req, res) => {
    const boardId = idOf(req.params.id);
    if (!boardId) fail(400, 'Invalid board id');
    await getBoard(boardId);
    const name = clean(req.body?.name, 80);
    if (!name) fail(400, 'Column name is required');
    const color = colorOf(req.body?.color, '#7c8cff');
    const isDone = req.body?.isDone ? 1 : 0;
    const [[max]] = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM board_columns WHERE board_id = ?',
      [boardId],
    );
    const [result] = await pool.query(
      'INSERT INTO board_columns (board_id, name, color, position, is_done) VALUES (?, ?, ?, ?, ?)',
      [boardId, name, color, max.p, isDone],
    );
    const [rows] = await pool.query('SELECT * FROM board_columns WHERE id = ?', [result.insertId]);
    boardChanged(req, boardId);
    res.status(201).json({ column: toColumn(rows[0]) });
  }),
);

api.patch(
  '/columns/:id',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid column id');
    const column = await getColumn(id);
    const body = req.body ?? {};
    const sets = [];
    const params = [];
    if (has(body, 'name')) {
      const name = clean(body.name, 80);
      if (!name) fail(400, 'Column name is required');
      sets.push('name = ?');
      params.push(name);
    }
    if (has(body, 'color')) {
      sets.push('color = ?');
      params.push(colorOf(body.color, '#64748b'));
    }
    if (has(body, 'wipLimit')) {
      const limit = body.wipLimit === '' || body.wipLimit === null ? null : Number(body.wipLimit);
      if (limit !== null && (!Number.isInteger(limit) || limit < 0 || limit > 999)) {
        fail(400, 'WIP limit must be between 0 and 999');
      }
      sets.push('wip_limit = ?');
      params.push(limit && limit > 0 ? limit : null);
    }
    if (has(body, 'isDone')) {
      sets.push('is_done = ?');
      params.push(body.isDone ? 1 : 0);
    }
    if (sets.length) {
      params.push(id);
      await pool.query(`UPDATE board_columns SET ${sets.join(', ')} WHERE id = ?`, params);
      boardChanged(req, column.board_id);
    }
    const [rows] = await pool.query('SELECT * FROM board_columns WHERE id = ?', [id]);
    res.json({ column: toColumn(rows[0]) });
  }),
);

api.delete(
  '/columns/:id',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid column id');
    const column = await getColumn(id);
    const [result] = await pool.query('DELETE FROM board_columns WHERE id = ?', [id]);
    if (!result.affectedRows) fail(404, 'Column not found');
    boardChanged(req, column.board_id);
    res.json({ ok: true });
  }),
);

/* ── Cards ─────────────────────────────────────────────────────────────────── */

api.post(
  '/cards',
  wrap(async (req, res) => {
    const boardId = idOf(req.body?.boardId);
    const columnId = idOf(req.body?.columnId);
    if (!boardId || !columnId) fail(400, 'Board and column are required');
    await getBoard(boardId);
    const [cols] = await pool.query(
      'SELECT id, name FROM board_columns WHERE id = ? AND board_id = ?',
      [columnId, boardId],
    );
    if (!cols.length) fail(400, 'Column does not belong to this board');

    const title = clean(req.body?.title, 255);
    if (!title) fail(400, 'Card title is required');
    const description = multiline(req.body?.description, 20000);
    const priority = priorityOf(req.body?.priority);
    const dueDate = dateOf(req.body?.dueDate);
    const assignee = clean(req.body?.assignee, 80);
    const labelIds = Array.isArray(req.body?.labelIds)
      ? [...new Set(req.body.labelIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
      : [];

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const labelId of labelIds) {
        const [found] = await conn.query('SELECT id FROM labels WHERE id = ?', [labelId]);
        if (!found.length) fail(400, 'Unknown label');
      }
      const [[max]] = await conn.query(
        'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM cards WHERE column_id = ? AND archived = 0',
        [columnId],
      );
      const [result] = await conn.query(
        `INSERT INTO cards
           (board_id, column_id, title, description, priority, due_date, assignee,
            created_by, created_by_name, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          boardId,
          columnId,
          title,
          description,
          priority,
          dueDate,
          assignee,
          req.user.id,
          req.user.name,
          max.p,
        ],
      );
      for (const labelId of labelIds) {
        await conn.query('INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)', [
          result.insertId,
          labelId,
        ]);
      }
      await recordActivity(
        conn,
        req,
        { id: result.insertId, board_id: boardId, title },
        'created',
        { detail: 'Created the card', toValue: cols[0].name },
      );
      if (assignee) {
        await recordActivity(
          conn,
          req,
          { id: result.insertId, board_id: boardId, title },
          'assigned',
          { detail: `Assigned to ${assignee}`, toValue: assignee },
        );
      }
      await conn.commit();
      const [rows] = await pool.query('SELECT * FROM cards WHERE id = ?', [result.insertId]);
      boardChanged(req, boardId);
      res.status(201).json({ card: toCard(rows[0]) });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }),
);

api.patch(
  '/cards/:id',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid card id');
    const card = await getCard(id);
    const body = req.body ?? {};
    const sets = [];
    const params = [];
    const events = [];
    let nextTitle = card.title;
    let nextColumn = null;

    if (has(body, 'title')) {
      const title = clean(body.title, 255);
      if (!title) fail(400, 'Card title is required');
      if (title !== card.title) {
        events.push({
          type: 'updated',
          detail: 'Renamed the card',
          fromValue: card.title,
          toValue: title,
        });
      }
      nextTitle = title;
      sets.push('title = ?');
      params.push(title);
    }
    if (has(body, 'description')) {
      const description = multiline(body.description, 20000);
      if (description !== (card.description ?? '')) {
        events.push({ type: 'updated', detail: 'Updated the description' });
      }
      sets.push('description = ?');
      params.push(description);
    }
    if (has(body, 'priority')) {
      const priority = priorityOf(body.priority);
      if (priority !== card.priority) {
        events.push({
          type: 'priority',
          detail: `Changed priority from ${priorityLabel(card.priority)} to ${priorityLabel(priority)}`,
          fromValue: priorityLabel(card.priority),
          toValue: priorityLabel(priority),
        });
      }
      sets.push('priority = ?');
      params.push(priority);
    }
    if (has(body, 'dueDate')) {
      const dueDate = dateOf(body.dueDate);
      const previous = card.due_date || null;
      if (dueDate !== previous) {
        events.push({
          type: 'due',
          detail: dueDate
            ? previous
              ? `Moved the due date to ${dueDate}`
              : `Set the due date to ${dueDate}`
            : 'Cleared the due date',
          fromValue: previous ?? '',
          toValue: dueDate ?? '',
        });
      }
      sets.push('due_date = ?');
      params.push(dueDate);
    }
    if (has(body, 'assignee')) {
      const assignee = clean(body.assignee, 80);
      const previous = card.assignee || '';
      if (assignee !== previous) {
        events.push({
          type: 'assigned',
          detail: assignee ? `Assigned to ${assignee}` : 'Marked as unassigned',
          fromValue: previous,
          toValue: assignee,
        });
      }
      sets.push('assignee = ?');
      params.push(assignee);
    }
    if (has(body, 'archived')) {
      const archived = body.archived ? 1 : 0;
      if (archived !== card.archived) {
        events.push(
          archived
            ? { type: 'archived', detail: 'Archived the card' }
            : { type: 'restored', detail: 'Restored the card from the archive' },
        );
      }
      sets.push('archived = ?');
      params.push(archived);
      if (!body.archived && card.archived && !has(body, 'columnId')) {
        const [[max]] = await pool.query(
          'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM cards WHERE column_id = ? AND archived = 0',
          [card.column_id],
        );
        sets.push('position = ?');
        params.push(max.p);
      }
    }
    if (has(body, 'columnId')) {
      const columnId = idOf(body.columnId);
      if (!columnId) fail(400, 'Invalid column');
      const [cols] = await pool.query(
        'SELECT id, name, is_done FROM board_columns WHERE id = ? AND board_id = ?',
        [columnId, card.board_id],
      );
      if (!cols.length) fail(400, 'Column does not belong to this board');
      nextColumn = cols[0];
      if (columnId !== card.column_id) {
        sets.push('column_id = ?');
        params.push(columnId);
        const [[max]] = await pool.query(
          'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM cards WHERE column_id = ? AND archived = 0',
          [columnId],
        );
        sets.push('position = ?');
        params.push(max.p);
      }
    }

    let labelIds = null;
    if (has(body, 'labelIds')) {
      if (!Array.isArray(body.labelIds)) fail(400, 'labelIds must be an array');
      labelIds = [...new Set(body.labelIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
      for (const labelId of labelIds) {
        const [found] = await pool.query('SELECT id FROM labels WHERE id = ?', [labelId]);
        if (!found.length) fail(400, 'Unknown label');
      }
      const [currentLinks] = await pool.query(
        'SELECT label_id FROM card_labels WHERE card_id = ? ORDER BY label_id',
        [id],
      );
      const before = currentLinks.map((row) => row.label_id).join(',');
      const after = [...labelIds].sort((a, b) => a - b).join(',');
      if (before !== after) {
        events.push({ type: 'labels', detail: 'Updated the card labels' });
      }
    }

    if (nextColumn && nextColumn.id !== card.column_id) {
      const [[oldColumn]] = await pool.query(
        'SELECT id, name, is_done FROM board_columns WHERE id = ?',
        [card.column_id],
      );
      if (nextColumn.is_done) {
        events.push({
          type: 'completed',
          detail: `Completed in ${nextColumn.name}`,
          fromValue: oldColumn?.name ?? '',
          toValue: nextColumn.name,
        });
      } else if (oldColumn?.is_done) {
        events.push({
          type: 'reopened',
          detail: `Reopened from ${oldColumn.name}`,
          fromValue: oldColumn.name,
          toValue: nextColumn.name,
        });
      } else {
        events.push({
          type: 'moved',
          detail: `Moved from ${oldColumn?.name ?? 'another column'} to ${nextColumn.name}`,
          fromValue: oldColumn?.name ?? '',
          toValue: nextColumn.name,
        });
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      if (sets.length) {
        params.push(id);
        await conn.query(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`, params);
      }
      if (labelIds) {
        await conn.query('DELETE FROM card_labels WHERE card_id = ?', [id]);
        for (const labelId of labelIds) {
          await conn.query('INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)', [id, labelId]);
        }
      }
      for (const event of events) {
        await recordActivity(
          conn,
          req,
          { id, board_id: card.board_id, title: nextTitle },
          event.type,
          event,
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const [rows] = await pool.query('SELECT * FROM cards WHERE id = ?', [id]);
    boardChanged(req, card.board_id);
    res.json({ card: toCard(rows[0]) });
  }),
);

api.delete(
  '/cards/:id',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid card id');
    const card = await getCard(id);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await recordActivity(
        conn,
        req,
        { id, board_id: card.board_id, title: card.title },
        'deleted',
        { detail: 'Deleted the card' },
      );
      const [result] = await conn.query('DELETE FROM cards WHERE id = ?', [id]);
      if (!result.affectedRows) fail(404, 'Card not found');
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    boardChanged(req, card.board_id);
    res.json({ ok: true });
  }),
);

/* ── Comments ──────────────────────────────────────────────────────────────── */

api.get(
  '/cards/:id/comments',
  wrap(async (req, res) => {
    const cardId = idOf(req.params.id);
    if (!cardId) fail(400, 'Invalid card id');
    await getCard(cardId);
    const [rows] = await pool.query(
      'SELECT * FROM comments WHERE card_id = ? ORDER BY created_at, id',
      [cardId],
    );
    res.json({ comments: rows.map(toComment) });
  }),
);

api.post(
  '/cards/:id/comments',
  wrap(async (req, res) => {
    const cardId = idOf(req.params.id);
    if (!cardId) fail(400, 'Invalid card id');
    const card = await getCard(cardId);
    const body = multiline(req.body?.body, 4000);
    if (!body) fail(400, 'Write something before posting');
    const [result] = await pool.query(
      'INSERT INTO comments (card_id, user_id, author_name, body) VALUES (?, ?, ?, ?)',
      [cardId, req.user.id, req.user.name, body],
    );
    const [rows] = await pool.query('SELECT * FROM comments WHERE id = ?', [result.insertId]);
    await recordActivity(
      pool,
      req,
      { id: cardId, board_id: card.board_id, title: card.title },
      'commented',
      { detail: body.length > 120 ? `${body.slice(0, 117)}…` : body },
    );
    notify(req, { scope: 'comment', cardId, boardId: card.board_id }, 'comment');
    res.status(201).json({ comment: toComment(rows[0]) });
  }),
);

api.delete(
  '/comments/:id',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid comment id');
    const [rows] = await pool.query(
      `SELECT cm.*, c.board_id FROM comments cm JOIN cards c ON c.id = cm.card_id WHERE cm.id = ?`,
      [id],
    );
    if (!rows.length) fail(404, 'Comment not found');
    const comment = rows[0];
    if (comment.user_id !== req.user.id && !isManager(req.user)) {
      fail(403, 'You can only delete your own comments');
    }
    await pool.query('DELETE FROM comments WHERE id = ?', [id]);
    notify(req, { scope: 'comment', cardId: comment.card_id, boardId: comment.board_id }, 'comment');
    res.json({ ok: true });
  }),
);

/* ── Drag & drop ordering ──────────────────────────────────────────────────── */

api.post(
  '/boards/:id/order',
  wrap(async (req, res) => {
    const boardId = idOf(req.params.id);
    if (!boardId) fail(400, 'Invalid board id');
    await getBoard(boardId);
    const columns = req.body?.columns;
    if (!Array.isArray(columns) || !columns.length) fail(400, 'No order supplied');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [cardSnapshot] = await conn.query(
        'SELECT id, column_id, title FROM cards WHERE board_id = ?',
        [boardId],
      );
      const prevColumn = new Map(cardSnapshot.map((row) => [row.id, row]));
      const [columnSnapshot] = await conn.query(
        'SELECT id, name, is_done FROM board_columns WHERE board_id = ?',
        [boardId],
      );
      const columnById = new Map(columnSnapshot.map((row) => [row.id, row]));

      const moves = [];
      for (const entry of columns) {
        const columnId = idOf(entry?.columnId);
        if (!columnId) fail(400, 'Invalid column in order');
        if (!columnById.has(columnId)) fail(400, 'Column does not belong to this board');
        const cardIds = Array.isArray(entry.cardIds) ? entry.cardIds : [];
        for (let position = 0; position < cardIds.length; position += 1) {
          const cardId = idOf(cardIds[position]);
          if (!cardId) fail(400, 'Invalid card in order');
          const [result] = await conn.query(
            'UPDATE cards SET column_id = ?, position = ? WHERE id = ? AND board_id = ?',
            [columnId, position, cardId, boardId],
          );
          if (!result.affectedRows) fail(400, 'Card does not belong to this board');
          const previous = prevColumn.get(cardId);
          if (previous && previous.column_id !== columnId) {
            moves.push({
              cardId,
              title: previous.title,
              from: columnById.get(previous.column_id),
              to: columnById.get(columnId),
            });
          }
        }
      }
      for (const move of moves) {
        const toName = move.to?.name ?? '';
        const fromName = move.from?.name ?? '';
        let type = 'moved';
        let detail = `Moved from ${fromName || 'another column'} to ${toName}`;
        if (move.to?.is_done) {
          type = 'completed';
          detail = `Completed in ${toName}`;
        } else if (move.from?.is_done) {
          type = 'reopened';
          detail = `Reopened from ${fromName}`;
        }
        await recordActivity(
          conn,
          req,
          { id: move.cardId, board_id: boardId, title: move.title },
          type,
          { detail, fromValue: fromName, toValue: toName },
        );
      }
      await conn.commit();
      boardChanged(req, boardId);
      res.json({ ok: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }),
);

/* ── Labels (global categories) ────────────────────────────────────────────── */

api.get(
  '/labels',
  wrap(async (req, res) => {
    res.json({ labels: await labelsFor() });
  }),
);

api.post(
  '/labels',
  wrap(async (req, res) => {
    const name = clean(req.body?.name, 60);
    if (!name) fail(400, 'Label name is required');
    const color = colorOf(req.body?.color);
    try {
      const [result] = await pool.query('INSERT INTO labels (name, color) VALUES (?, ?)', [name, color]);
      const [rows] = await pool.query(
        'SELECT l.*, 0 AS card_count FROM labels l WHERE l.id = ?',
        [result.insertId],
      );
      labelsChanged(req);
      res.status(201).json({ label: publicLabel(rows[0]) });
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') fail(409, 'A label with that name already exists');
      throw err;
    }
  }),
);

api.patch(
  '/labels/:id',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid label id');
    const body = req.body ?? {};
    const sets = [];
    const params = [];
    if (has(body, 'name')) {
      const name = clean(body.name, 60);
      if (!name) fail(400, 'Label name is required');
      sets.push('name = ?');
      params.push(name);
    }
    if (has(body, 'color')) {
      sets.push('color = ?');
      params.push(colorOf(body.color));
    }
    if (!sets.length) fail(400, 'Nothing to update');
    params.push(id);
    try {
      const [result] = await pool.query(`UPDATE labels SET ${sets.join(', ')} WHERE id = ?`, params);
      if (!result.affectedRows) fail(404, 'Label not found');
      const [rows] = await pool.query(
        `SELECT l.*, (SELECT COUNT(*) FROM card_labels cl
                         JOIN cards c ON c.id = cl.card_id
                        WHERE cl.label_id = l.id AND c.archived = 0) AS card_count
           FROM labels l WHERE l.id = ?`,
        [id],
      );
      labelsChanged(req);
      res.json({ label: publicLabel(rows[0]) });
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') fail(409, 'A label with that name already exists');
      throw err;
    }
  }),
);

api.delete(
  '/labels/:id',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid label id');
    const [result] = await pool.query('DELETE FROM labels WHERE id = ?', [id]);
    if (!result.affectedRows) fail(404, 'Label not found');
    labelsChanged(req);
    res.json({ ok: true });
  }),
);

/* ── Error handling ─────────────────────────────────────────────────────────── */

api.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

api.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError || err?.status) {
    res.status(err.status || 400).json({ error: err.message || 'Bad request' });
    return;
  }
  if (err?.code === 'ER_DUP_ENTRY') {
    res.status(409).json({ error: 'That value already exists' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  console.error('[api]', err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});
