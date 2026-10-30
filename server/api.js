import express from 'express';
import {
  requireAuth,
  findUser,
  checkPassword,
  setSessionCookie,
  clearSessionCookie,
  publicUser,
} from './auth.js';
import { pool } from './db.js';
import { config } from './config.js';

export const api = express.Router();

api.use(express.json({ limit: '1mb' }));

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

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
  position: row.position,
  archived: !!row.archived,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  labels: [],
});

const publicLabel = (row) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  cardCount: Number(row.card_count ?? 0),
  createdAt: row.created_at,
});

async function getBoard(id) {
  const [rows] = await pool.query('SELECT * FROM boards WHERE id = ?', [id]);
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

/* ── Auth ──────────────────────────────────────────────────────────────────── */

const loginAttempts = new Map();
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000;

api.post(
  '/auth/login',
  wrap(async (req, res) => {
    const username = clean(req.body?.username, 60).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const key = `${req.ip}|${username}`;
    const now = Date.now();
    const record = loginAttempts.get(key);

    if (record?.lockedUntil && record.lockedUntil > now) {
      const minutes = Math.ceil((record.lockedUntil - now) / 60000);
      fail(429, `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    }

    const user = findUser(username);
    const valid = !!user && checkPassword(user, password);
    if (!valid) {
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

api.get(
  '/health',
  wrap(async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  }),
);

// Everything past this point requires a signed-in user.
api.use(requireAuth);

api.get('/meta', (req, res) => {
  res.json({
    users: config.users.map(({ username, name, role }) => ({ username, name, role })),
    priorities: PRIORITIES,
  });
});

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
    }
    const [rows] = await pool.query('SELECT * FROM boards WHERE id = ?', [id]);
    res.json({ board: toBoard(rows[0]) });
  }),
);

api.delete(
  '/boards/:id',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid board id');
    const [result] = await pool.query('DELETE FROM boards WHERE id = ?', [id]);
    if (!result.affectedRows) fail(404, 'Board not found');
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
      'SELECT * FROM cards WHERE board_id = ? ORDER BY position, id',
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
    res.status(201).json({ column: toColumn(rows[0]) });
  }),
);

api.patch(
  '/columns/:id',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid column id');
    await getColumn(id);
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
    const [result] = await pool.query('DELETE FROM board_columns WHERE id = ?', [id]);
    if (!result.affectedRows) fail(404, 'Column not found');
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
      'SELECT id FROM board_columns WHERE id = ? AND board_id = ?',
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
        `INSERT INTO cards (board_id, column_id, title, description, priority, due_date, assignee, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [boardId, columnId, title, description, priority, dueDate, assignee, max.p],
      );
      for (const labelId of labelIds) {
        await conn.query('INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)', [
          result.insertId,
          labelId,
        ]);
      }
      await conn.commit();
      const [rows] = await pool.query('SELECT * FROM cards WHERE id = ?', [result.insertId]);
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

    if (has(body, 'title')) {
      const title = clean(body.title, 255);
      if (!title) fail(400, 'Card title is required');
      sets.push('title = ?');
      params.push(title);
    }
    if (has(body, 'description')) {
      sets.push('description = ?');
      params.push(multiline(body.description, 20000));
    }
    if (has(body, 'priority')) {
      sets.push('priority = ?');
      params.push(priorityOf(body.priority));
    }
    if (has(body, 'dueDate')) {
      sets.push('due_date = ?');
      params.push(dateOf(body.dueDate));
    }
    if (has(body, 'assignee')) {
      sets.push('assignee = ?');
      params.push(clean(body.assignee, 80));
    }
    if (has(body, 'archived')) {
      sets.push('archived = ?');
      params.push(body.archived ? 1 : 0);
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
        'SELECT id FROM board_columns WHERE id = ? AND board_id = ?',
        [columnId, card.board_id],
      );
      if (!cols.length) fail(400, 'Column does not belong to this board');
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
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const [rows] = await pool.query('SELECT * FROM cards WHERE id = ?', [id]);
    res.json({ card: toCard(rows[0]) });
  }),
);

api.delete(
  '/cards/:id',
  wrap(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) fail(400, 'Invalid card id');
    const [result] = await pool.query('DELETE FROM cards WHERE id = ?', [id]);
    if (!result.affectedRows) fail(404, 'Card not found');
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
      for (const entry of columns) {
        const columnId = idOf(entry?.columnId);
        if (!columnId) fail(400, 'Invalid column in order');
        const [col] = await conn.query(
          'SELECT id FROM board_columns WHERE id = ? AND board_id = ?',
          [columnId, boardId],
        );
        if (!col.length) fail(400, 'Column does not belong to this board');
        const cardIds = Array.isArray(entry.cardIds) ? entry.cardIds : [];
        for (let position = 0; position < cardIds.length; position += 1) {
          const cardId = idOf(cardIds[position]);
          if (!cardId) fail(400, 'Invalid card in order');
          const [result] = await conn.query(
            'UPDATE cards SET column_id = ?, position = ? WHERE id = ? AND board_id = ?',
            [columnId, position, cardId, boardId],
          );
          if (!result.affectedRows) fail(400, 'Card does not belong to this board');
        }
      }
      await conn.commit();
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
