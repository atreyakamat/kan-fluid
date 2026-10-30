import { pool } from './db.js';
import { config } from './config.js';
import { hashPassword } from './auth.js';

const PALETTE = {
  Bug: '#f43f5e',
  Feature: '#7c8cff',
  Design: '#f472b6',
  Ops: '#fbbf24',
  Urgent: '#fb923c',
  Docs: '#22d3ee',
};

/* ── Users ────────────────────────────────────────────────────────────────── */

export async function seedUsers() {
  const [[count]] = await pool.query('SELECT COUNT(*) AS n FROM users');
  if (count.n > 0) return;

  const { username, password, name } = config.initialAdmin;
  const passwordHash = await hashPassword(password);
  await pool.query(
    `INSERT INTO users
       (username, name, role, password_hash, must_change_password, onboarded, tour_completed, theme)
     VALUES (?, ?, 'Owner', ?, 1, 0, 0, 'light')`,
    [username, name, passwordHash],
  );

  console.log(
    `[seed] Created the first account → ${username} / ${password} (you will be asked to change it).`,
  );
}

const dateOffset = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const demoCards = (columns, users) => [
  {
    column: columns.Backlog,
    title: 'Plan Q4 roadmap',
    description: 'Collect team input, draft the themes for next quarter and share a first version.',
    priority: 'medium',
    assignee: users[0],
    labels: ['Docs', 'Feature'],
    position: 0,
  },
  {
    column: columns.Backlog,
    title: 'Renew SSL certificate',
    description: 'Certificate expires soon — renew it and reload the gateway config.',
    priority: 'high',
    assignee: users[0],
    labels: ['Urgent', 'Ops'],
    due: dateOffset(6),
    position: 1,
  },
  {
    column: columns.Backlog,
    title: 'Write onboarding checklist',
    description: 'Accounts, tooling access, first-week goals. Keep it in the team wiki.',
    priority: 'low',
    assignee: users[1] ?? users[0],
    labels: ['Docs'],
    position: 2,
  },
  {
    column: columns['In Progress'],
    title: 'Migrate reporting pipeline',
    description: 'Move the nightly report job to the new worker and compare outputs for a week.',
    priority: 'high',
    assignee: users[0],
    labels: ['Feature'],
    due: dateOffset(11),
    position: 0,
  },
  {
    column: columns['In Progress'],
    title: 'Fix login redirect loop',
    description: 'Expired session cookie causes a redirect loop on /dashboard. Add a guard and a fallback.',
    priority: 'urgent',
    assignee: users[1] ?? users[0],
    labels: ['Bug', 'Urgent'],
    due: dateOffset(2),
    position: 1,
  },
  {
    column: columns.Review,
    title: 'Refresh the landing page',
    description: 'New hero, simplified pricing block and a clearer primary call to action.',
    priority: 'medium',
    assignee: users[0],
    labels: ['Design'],
    position: 0,
  },
  {
    column: columns.Review,
    title: 'Update API docs',
    description: 'Document the new filters endpoint and add request examples.',
    priority: 'medium',
    assignee: users[1] ?? users[0],
    labels: ['Docs'],
    position: 1,
  },
  {
    column: columns.Done,
    title: 'Set up staging environment',
    description: 'Dedicated database, seed data and a deploy hook from the main branch.',
    priority: 'low',
    assignee: users[0],
    labels: ['Ops'],
    position: 0,
  },
];

export async function seedIfEmpty() {
  const [[labelCount]] = await pool.query('SELECT COUNT(*) AS n FROM labels');
  if (labelCount.n === 0) {
    const values = Object.entries(PALETTE).map(([name, color]) => [name, color]);
    for (const [name, color] of values) {
      await pool.query('INSERT INTO labels (name, color) VALUES (?, ?)', [name, color]);
    }
    console.log('[seed] Added starter labels.');
  }

  const [[boardCount]] = await pool.query('SELECT COUNT(*) AS n FROM boards');
  if (boardCount.n > 0) return;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [boardResult] = await conn.query(
      'INSERT INTO boards (name, description, accent, position) VALUES (?, ?, ?, 0)',
      ['My Work', 'Everything shipping this quarter.', '#7c8cff'],
    );
    const boardId = boardResult.insertId;

    const columnDefs = [
      ['Backlog', '#94a3b8', 0],
      ['In Progress', '#7c8cff', 0],
      ['Review', '#fbbf24', 0],
      ['Done', '#34d399', 1],
    ];
    const columns = {};
    for (let i = 0; i < columnDefs.length; i += 1) {
      const [name, color, isDone] = columnDefs[i];
      const [result] = await conn.query(
        'INSERT INTO board_columns (board_id, name, color, position, is_done) VALUES (?, ?, ?, ?, ?)',
        [boardId, name, color, i, isDone],
      );
      columns[name] = result.insertId;
    }

    const [labelRows] = await conn.query('SELECT id, name FROM labels');
    const labelIds = new Map(labelRows.map((row) => [row.name, row.id]));
    const [userRows] = await conn.query('SELECT id, name FROM users WHERE active = 1 ORDER BY id');
    const users = userRows.map((row) => ({ id: row.id, name: row.name }));
    if (!users.length) throw new Error('Cannot seed demo cards without an active user');
    const userNames = users.map((u) => u.name);
    const owner = users[0];

    const doneColumnId = columns.Done;
    for (const card of demoCards(columns, userNames)) {
      const creator =
        users.find((u) => u.name === card.assignee) ?? owner;
      const [result] = await conn.query(
        `INSERT INTO cards
           (board_id, column_id, title, description, priority, due_date, assignee,
            created_by, created_by_name, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          boardId,
          card.column,
          card.title,
          card.description ?? '',
          card.priority ?? 'medium',
          card.due ?? null,
          card.assignee ?? '',
          creator.id,
          creator.name,
          card.position ?? 0,
        ],
      );
      for (const labelName of card.labels ?? []) {
        const labelId = labelIds.get(labelName);
        if (labelId) {
          await conn.query('INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)', [
            result.insertId,
            labelId,
          ]);
        }
      }

      const createdOffset = card.column === doneColumnId ? -14 : -4;
      await conn.query(
        `INSERT INTO card_activity
           (board_id, card_id, card_title, user_id, user_name, type, detail, from_value, to_value, created_at)
         VALUES (?, ?, ?, ?, ?, 'created', 'Created the card', '', 'Backlog', DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [boardId, result.insertId, card.title, creator.id, creator.name, -createdOffset],
      );
      if (card.column === doneColumnId) {
        await conn.query(
          `INSERT INTO card_activity
             (board_id, card_id, card_title, user_id, user_name, type, detail, from_value, to_value, created_at)
           VALUES (?, ?, ?, ?, ?, 'completed', 'Completed in Done', 'Review', 'Done', DATE_SUB(NOW(), INTERVAL 2 DAY))`,
          [boardId, result.insertId, card.title, creator.id, creator.name],
        );
      }
    }

    await conn.commit();
    console.log(`[seed] Created demo board "My Work" with ${columnDefs.length} columns.`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
