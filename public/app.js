'use strict';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  tag: '<path d="M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.6-4 4.4-6 8-6s6.4 2 8 6"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  archive:
    '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8M10 12h4"/>',
  restore: '<path d="M4 11a8 8 0 1 1 2.5 6"/><path d="M4 5v6h6"/>',
  settings:
    '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="17" r="2"/>',
  logout: '<path d="M15 4h4v16h-4M11 8l4 4-4 4M3 12h11"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  alert: '<path d="M12 4v10M12 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  flag: '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
};

const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;

const PRIORITIES = {
  low: { label: 'Low', color: '#38bdf8' },
  medium: { label: 'Medium', color: '#fbbf24' },
  high: { label: 'High', color: '#fb923c' },
  urgent: { label: 'Urgent', color: '#f43f5e' },
};
const PRIORITY_KEYS = ['urgent', 'high', 'medium', 'low'];

const PALETTE = [
  '#7c8cff',
  '#22d3ee',
  '#34d399',
  '#fbbf24',
  '#fb923c',
  '#f43f5e',
  '#f472b6',
  '#a78bfa',
  '#38bdf8',
  '#94a3b8',
];

const BOARD_KEY = 'kan.currentBoard';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

const toLocalDate = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const dueLabel = (str) => {
  if (!str) return '';
  const date = toLocalDate(str);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((date - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
};

const formatDateTime = (str) => {
  if (!str) return '';
  const date = new Date(String(str).replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const initials = (name) => {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase().slice(0, 2);
};

const hueOf = (name) => {
  let h = 0;
  for (const ch of String(name ?? '')) h = (h * 33 + ch.charCodeAt(0)) % 360;
  return h;
};

const isTyping = (target) =>
  !!target &&
  (target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable);

/* ── State ────────────────────────────────────────────────────────────────── */

const state = {
  user: null,
  boards: [],
  board: null,
  columns: [],
  cards: [],
  labels: [],
  meta: { users: [], priorities: [] },
  filters: { q: '', labelIds: new Set(), assignee: '', priority: '' },
  quickAdd: null,
  quickAddValue: '',
  labelMenuOpen: false,
  drag: null,
  suppressClick: false,
};

const ui = {};

/* ── API ──────────────────────────────────────────────────────────────────── */

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) handleSignedOut();
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

/* ── Toasts ───────────────────────────────────────────────────────────────── */

function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info')}<span>${esc(
    message,
  )}</span>`;
  ui.toasts.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  }, 3400);
}

/* ── Rendering: sidebar ───────────────────────────────────────────────────── */

function renderUser() {
  if (!state.user) return;
  ui.userChip.innerHTML = `
    <span class="avatar" style="--h:${hueOf(state.user.name)}">${esc(initials(state.user.name))}</span>
    <div class="user-meta"><strong>${esc(state.user.name)}</strong><span>${esc(state.user.role)}</span></div>`;
}

function renderSidebar() {
  ui.boardList.innerHTML =
    state.boards
      .map(
        (board) => `
      <button class="board-item ${state.board?.id === board.id ? 'active' : ''}" data-board-id="${board.id}">
        <span class="board-dot" style="--c:${esc(board.accent)}"></span>
        <span class="board-name">${esc(board.name)}</span>
        <span class="board-count">${board.cardCount}</span>
      </button>`,
      )
      .join('') || '<p class="side-hint">No boards yet.</p>';

  ui.sideLabels.innerHTML =
    state.labels
      .map(
        (label) => `
      <button class="label-pill ${state.filters.labelIds.has(label.id) ? 'active' : ''}"
              data-label-filter="${label.id}" style="--c:${esc(label.color)}"
              title="Filter by ${esc(label.name)}">
        <i></i>${esc(label.name)}<span class="n">${label.cardCount}</span>
      </button>`,
      )
      .join('') || '<p class="side-hint">No labels yet — use “Manage” to add some.</p>';
}

/* ── Rendering: board head & filter bar ───────────────────────────────────── */

function activeCards() {
  return state.cards.filter((card) => !card.archived);
}

function doneCount() {
  const doneColumns = new Set(state.columns.filter((column) => column.isDone).map((column) => column.id));
  return activeCards().filter((card) => doneColumns.has(card.columnId)).length;
}

function renderBoardHead() {
  if (!state.board) {
    ui.boardHead.innerHTML = `
      <div class="board-eyebrow">Workspace</div>
      <h2 class="board-title">Your boards</h2>
      <p class="board-desc empty">Create your first board to start planning.</p>`;
    return;
  }

  const total = activeCards().length;
  const done = doneCount();
  const pct = total ? Math.round((done / total) * 100) : 0;
  const description = state.board.description?.trim();

  ui.boardHead.innerHTML = `
    <div class="board-eyebrow"><span class="board-dot" style="--c:${esc(state.board.accent)}"></span>Board</div>
    <h2 class="board-title">${esc(state.board.name)}</h2>
    <p class="board-desc ${description ? '' : 'empty'}">${esc(
      description || 'No description — add one in board settings.',
    )}</p>
    <div class="board-progress" style="--board-accent:${esc(state.board.accent)}">
      <div class="progress-bar"><span style="width:${pct}%"></span></div>
      <span class="progress-label">${done} of ${total} done</span>
    </div>`;
}

const filtersActive = () =>
  !!state.filters.q ||
  state.filters.labelIds.size > 0 ||
  !!state.filters.assignee ||
  !!state.filters.priority;

function assigneeNames() {
  const names = new Set();
  for (const user of state.meta.users ?? []) if (user.name) names.add(user.name);
  for (const card of state.cards) if (card.assignee) names.add(card.assignee);
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function cardMatches(card) {
  const { q, labelIds, assignee, priority } = state.filters;
  if (q) {
    const haystack = [
      card.title,
      card.description,
      card.assignee,
      ...(card.labels ?? []).map((label) => label.name),
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (labelIds.size && !(card.labels ?? []).some((label) => labelIds.has(label.id))) return false;
  if (assignee) {
    if (assignee === '__none__' ? !!card.assignee : card.assignee !== assignee) return false;
  }
  if (priority && card.priority !== priority) return false;
  return true;
}

function renderFilterbar() {
  const flag = filtersActive();
  ui.filterbar.classList.toggle('hidden', !state.board);
  ui.labelFilterCount.textContent = String(state.filters.labelIds.size);
  ui.labelFilterCount.classList.toggle('hidden', state.filters.labelIds.size === 0);
  ui.btnLabelFilter.classList.toggle('active', state.filters.labelIds.size > 0);
  ui.btnLabelFilter.setAttribute('aria-expanded', String(state.labelMenuOpen));
  ui.btnArchived.classList.toggle('active', false);
  ui.btnClearFilters.classList.toggle('hidden', !flag);

  const archived = state.cards.filter((card) => card.archived).length;
  ui.archivedCount.textContent = String(archived);
  ui.archivedCount.classList.toggle('hidden', archived === 0);

  ui.filterPriority.value = state.filters.priority;
  if (!ui.filterQ.matches(':focus') && ui.filterQ.value !== state.filters.q) {
    ui.filterQ.value = state.filters.q;
  }

  const names = assigneeNames();
  const current = state.filters.assignee;
  ui.filterAssignee.innerHTML =
    '<option value="">All assignees</option><option value="__none__">Unassigned</option>' +
    names.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  ui.filterAssignee.value = current;

  ui.labelPopover.innerHTML = `
    <div class="popover-head"><span>${state.labels.length} global labels</span>${
      state.filters.labelIds.size
        ? '<button class="text-btn" data-clear-label-filter>Clear</button>'
        : ''
    }</div>
    ${
      state.labels.length
        ? state.labels
            .map(
              (label) => `
          <button class="popover-row ${state.filters.labelIds.has(label.id) ? 'on' : ''}"
                  data-label-filter="${label.id}" style="--c:${esc(label.color)}">
            <span class="chip" style="--c:${esc(label.color)}"><i></i>${esc(label.name)}</span>
            <span class="n">${label.cardCount}</span>
          </button>`,
            )
            .join('')
        : '<p class="popover-empty">No labels yet. Create global labels from the sidebar to categorise cards on every board.</p>'
    }`;
  ui.labelPopover.classList.toggle('hidden', !state.labelMenuOpen);

  const total = activeCards().length;
  const visible = activeCards().filter(cardMatches).length;
  if (flag) {
    ui.viewHint.textContent = `${visible}/${total} cards · drag paused while filtering`;
    ui.viewHint.classList.add('warn');
  } else {
    ui.viewHint.textContent = `${total} card${total === 1 ? '' : 's'}`;
    ui.viewHint.classList.remove('warn');
  }
}

/* ── Rendering: board & cards ─────────────────────────────────────────────── */

const labelsChip = (label) =>
  `<span class="chip" style="--c:${esc(label.color)}" title="${esc(label.name)}"><i></i>${esc(
    label.name,
  )}</span>`;

function cardHtml(card) {
  const priority = PRIORITIES[card.priority] ?? PRIORITIES.medium;
  const extraLabels = (card.labels?.length ?? 0) - 3;
  const labelMarkup = (card.labels ?? [])
    .slice(0, 3)
    .map(labelsChip)
    .join('');
  const overdue = card.dueDate && card.dueDate < todayStr();
  const dueMarkup = card.dueDate
    ? `<span class="meta-chip ${overdue ? 'overdue' : ''}" title="Due ${esc(card.dueDate)}">${icon(
        'calendar',
      )}${esc(dueLabel(card.dueDate))}</span>`
    : '';
  const assignee = card.assignee
    ? `<span class="avatar sm" style="--h:${hueOf(card.assignee)}" title="${esc(
        card.assignee,
      )}">${esc(initials(card.assignee))}</span>`
    : `<span class="assignee-ghost" title="Unassigned">${icon('user')}</span>`;

  return `
    <article class="card prio-${esc(card.priority)}" data-card-id="${card.id}"
             draggable="${filtersActive() ? 'false' : 'true'}" tabindex="0" role="button"
             aria-label="${esc(card.title)}">
      ${labelMarkup ? `<div class="card-labels">${labelMarkup}${
        extraLabels > 0 ? `<span class="chip" style="--c:#94a3b8">+${extraLabels}</span>` : ''
      }</div>` : ''}
      <h4 class="card-title">${esc(card.title)}</h4>
      ${card.description ? `<p class="card-desc">${esc(card.description)}</p>` : ''}
      <div class="card-foot">
        <div class="card-foot-left">
          <span class="prio-badge">${icon('flag')}${priority.label}</span>
          ${dueMarkup}
        </div>
        ${assignee}
      </div>
    </article>`;
}

function columnHtml(column) {
  const cards = activeCards()
    .filter((card) => card.columnId === column.id)
    .sort((a, b) => a.position - b.position || a.id - b.id);
  const filtering = filtersActive();
  const visible = filtering ? cards.filter(cardMatches) : cards;
  const countText = filtering ? `${visible.length}/${cards.length}` : String(cards.length);
  const overLimit = column.wipLimit != null && cards.length > column.wipLimit;
  const wip = column.wipLimit != null
    ? `<span class="wip ${overLimit ? 'over' : ''}" title="Work-in-progress limit">${cards.length}/${column.wipLimit}</span>`
    : '';
  const quickOpen = state.quickAdd === column.id;

  let bodyContent;
  if (!cards.length) {
    bodyContent = '<div class="column-empty">Drop your first card here</div>';
  } else if (!visible.length) {
    bodyContent = '<div class="column-empty no-match">No cards match your filters</div>';
  } else {
    bodyContent = visible.map(cardHtml).join('');
  }

  return `
    <section class="column" data-column-id="${column.id}">
      <header class="column-head">
        <div class="column-title">
          <span class="col-dot" style="--c:${esc(column.color)}"></span>
          <h3>${esc(column.name)}</h3>
          <span class="column-count ${filtering ? 'filtered' : ''}">${countText}</span>
          ${wip}
        </div>
        <div class="column-actions">
          <button class="icon-btn" data-col-settings="${column.id}" title="Column settings" aria-label="Column settings">
            ${icon('settings')}
          </button>
        </div>
      </header>
      <div class="column-body" data-column-id="${column.id}">${bodyContent}</div>
      <footer class="column-foot">
        ${
          quickOpen
            ? `<div class="quick-add">
                <textarea class="quick-add-input" rows="2" placeholder="What needs doing?">${esc(
                  state.quickAddValue,
                )}</textarea>
                <div class="quick-add-row">
                  <span class="hint">Enter to add · Esc to close</span>
                  <button class="btn ghost sm" data-quick-close>Cancel</button>
                  <button class="btn primary sm" data-quick-add>Add</button>
                </div>
              </div>`
            : `<button class="add-card" data-quick-open="${column.id}">${icon('plus')}Add card</button>`
        }
      </footer>
    </section>`;
}

function renderBoard() {
  const scrollLeft = ui.board.scrollLeft;

  if (!state.board) {
    ui.board.innerHTML = `
      <div class="board-empty">
        <div class="logo" aria-hidden="true"><i></i><i></i><i></i></div>
        <h2>Let’s build your first board</h2>
        <p>Boards hold columns, cards, and the global labels you use to categorise work across everything.</p>
        <div class="empty-actions">
          <button class="btn primary" id="empty-create-board">${icon('plus')}Create a board</button>
        </div>
      </div>`;
    ui.topbarActions.classList.add('hidden');
    return;
  }

  ui.topbarActions.classList.remove('hidden');

  if (!state.columns.length) {
    ui.board.innerHTML = `
      <div class="board-empty">
        <div class="logo" aria-hidden="true"><i></i><i></i><i></i></div>
        <h2>No columns yet</h2>
        <p>Columns are the stages work moves through. Add your first one to start using this board.</p>
        <div class="empty-actions">
          <button class="btn primary" id="empty-add-column">${icon('plus')}Add a column</button>
        </div>
      </div>`;
    return;
  }

  ui.board.innerHTML =
    state.columns.map(columnHtml).join('') +
    `<div class="add-column"><button class="add-column-btn" id="btn-add-column">${icon(
      'plus',
    )}Add column</button></div>`;

  ui.board.scrollLeft = scrollLeft;
  if (state.quickAdd && !ui.modalRoot.querySelector('.modal')) {
    const textarea = $('.quick-add textarea', ui.board);
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }
}

function renderAll() {
  renderUser();
  renderSidebar();
  renderBoardHead();
  renderFilterbar();
  renderBoard();
}

/* ── Data loading ─────────────────────────────────────────────────────────── */

async function loadMeta() {
  const data = await api('/meta');
  state.meta = data;
}

async function loadBoards() {
  const data = await api('/boards');
  state.boards = data.boards;
}

async function loadBoard(id) {
  const data = await api(`/boards/${id}`);
  state.board = data.board;
  state.columns = data.columns;
  state.cards = data.cards;
  state.labels = data.labels;
  if (!state.columns.some((column) => column.id === state.quickAdd)) state.quickAdd = null;
  for (const labelId of Array.from(state.filters.labelIds)) {
    if (!state.labels.some((label) => label.id === labelId)) state.filters.labelIds.delete(labelId);
  }
  try {
    localStorage.setItem(BOARD_KEY, String(id));
  } catch {
    /* ignore */
  }
  renderAll();
}

async function refreshBoard() {
  const id = state.board?.id;
  await loadBoards();
  if (id) {
    await loadBoard(id);
  } else {
    const { labels } = await api('/labels');
    state.labels = labels;
    renderAll();
  }
}

async function selectBoard(id) {
  if (state.board?.id === id) {
    closeSidebar();
    return;
  }
  closeSidebar();
  try {
    await loadBoard(id);
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ── Auth / boot ──────────────────────────────────────────────────────────── */

function showLogin() {
  closeModal();
  state.user = null;
  state.boards = [];
  state.board = null;
  state.columns = [];
  state.cards = [];
  state.labels = [];
  state.filters = { q: '', labelIds: new Set(), assignee: '', priority: '' };
  state.quickAdd = null;
  state.quickAddValue = '';
  ui.app.classList.add('hidden');
  ui.sidebar.classList.remove('open');
  ui.scrim.classList.add('hidden');
  ui.login.classList.remove('hidden');
  ui.loginError.textContent = '';
  ui.loginUsername.value = '';
  ui.loginPassword.value = '';
  ui.loginSubmit.disabled = false;
  setTimeout(() => ui.loginUsername.focus(), 30);
}

function handleSignedOut() {
  showLogin();
}

async function enterApp() {
  renderUser();
  try {
    await Promise.all([loadMeta(), loadBoards()]);
  } catch (err) {
    toast(err.message, 'error');
    return;
  }

  let stored = NaN;
  try {
    stored = Number(localStorage.getItem(BOARD_KEY));
  } catch {
    /* ignore */
  }
  const target = state.boards.find((board) => board.id === stored) ?? state.boards[0];

  if (target) {
    try {
      await loadBoard(target.id);
    } catch (err) {
      // The saved board may have been removed — fall back to the first one.
      const fallback = state.boards[0];
      if (fallback && fallback.id !== target.id) await loadBoard(fallback.id);
      else {
        renderAll();
        toast(err.message, 'error');
      }
    }
  } else {
    try {
      const { labels } = await api('/labels');
      state.labels = labels;
    } catch {
      /* ignore */
    }
    renderAll();
  }
}

async function onLogin(event) {
  event.preventDefault();
  const username = ui.loginUsername.value.trim();
  const password = ui.loginPassword.value;
  ui.loginError.textContent = '';
  if (!username || !password) {
    ui.loginError.textContent = 'Enter your username and password.';
    return;
  }

  ui.loginSubmit.disabled = true;
  try {
    const { user } = await api('/auth/login', { method: 'POST', body: { username, password } });
    state.user = user;
    ui.login.classList.add('hidden');
    ui.app.classList.remove('hidden');
    await enterApp();
  } catch (err) {
    ui.loginError.textContent = err.message;
    ui.loginPassword.select();
    ui.loginSubmit.disabled = false;
  }
}

async function onLogout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
  showLogin();
}

/* ── Modal primitives ─────────────────────────────────────────────────────── */

function closeModal() {
  ui.modalRoot.innerHTML = '';
  document.body.classList.remove('modal-open');
}

function openModal(html, { className = '' } = {}) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal ${className}" role="dialog" aria-modal="true">${html}</div>`;
  ui.modalRoot.appendChild(wrap);
  const modal = wrap.querySelector('.modal');

  wrap.addEventListener('mousedown', (event) => {
    if (event.target === wrap) closeModal();
  });
  wrap.addEventListener('click', (event) => {
    if (event.target.closest('[data-act="close"]')) closeModal();
  });

  return modal;
}

function confirmDialog({ title, message, confirmLabel = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop confirm-backdrop';
    wrap.style.zIndex = '120';
    wrap.innerHTML = `
      <div class="modal sm" role="alertdialog" aria-modal="true">
        <div class="modal-head">
          <div><h3>${esc(title)}</h3></div>
          <button class="icon-btn" data-confirm="false" aria-label="Cancel">${icon('x')}</button>
        </div>
        <div class="confirm-body">${message}</div>
        <div class="confirm-foot">
          <button class="btn ghost" data-confirm="false">Cancel</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-confirm="true">${esc(confirmLabel)}</button>
        </div>
      </div>`;
    ui.modalRoot.appendChild(wrap);

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        finish(false);
      }
      if (event.key === 'Enter') {
        finish(true);
      }
    };
    const finish = (value) => {
      document.removeEventListener('keydown', onKey, true);
      wrap.remove();
      resolve(value);
    };

    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('mousedown', (event) => {
      if (event.target === wrap) finish(false);
    });
    wrap.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-confirm]');
      if (!btn) return;
      finish(btn.dataset.confirm === 'true');
    });
    setTimeout(() => wrap.querySelector('[data-confirm="true"]')?.focus(), 40);
  });
}

/* ── Card modal ───────────────────────────────────────────────────────────── */

function openCardModal(cardId = null, columnId = null) {
  if (!state.board) {
    toast('Create a board first', 'error');
    return;
  }
  if (!state.columns.length) {
    toast('Add a column before creating cards', 'error');
    return;
  }

  const card = cardId ? state.cards.find((item) => item.id === cardId) : null;
  const isNew = !card;
  const selected = new Set((card?.labels ?? []).map((label) => label.id));
  const activeColumn = columnId ?? card?.columnId ?? state.columns[0].id;

  const labelMarkup = state.labels.length
    ? state.labels
        .map(
          (label) => `
        <button type="button" class="label-toggle ${selected.has(label.id) ? 'on' : ''}"
                data-label-toggle="${label.id}" aria-pressed="${selected.has(label.id)}"
                style="--c:${esc(label.color)}">
          <span class="label-dot"></span>${esc(label.name)}
        </button>`,
        )
        .join('')
    : '<p class="label-empty-hint">No global labels yet — create them from the sidebar.</p>';

  const columnOptions = state.columns
    .map(
      (column) =>
        `<option value="${column.id}" ${activeColumn === column.id ? 'selected' : ''}>${esc(
          column.name,
        )}</option>`,
    )
    .join('');

  const priorityOptions = PRIORITY_KEYS.map(
    (key) =>
      `<option value="${key}" ${(card?.priority ?? 'medium') === key ? 'selected' : ''}>${
        PRIORITIES[key].label
      }</option>`,
  ).join('');

  const assigneeOptions = assigneeNames()
    .map((name) => `<option value="${esc(name)}"></option>`)
    .join('');

  const modal = openModal(
    `
    <div class="modal-head">
      <div>
        <h3>${isNew ? 'New card' : 'Edit card'}</h3>
        <p class="modal-sub">${isNew ? 'Capture the work, then drag it through your columns.' : 'Update details, labels and placement.'}</p>
      </div>
      <button class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="card-form">
        <div class="card-main">
          <input class="title-input" id="card-title" placeholder="Card title" maxlength="255"
                 value="${esc(card?.title ?? '')}" aria-label="Card title">
          <div class="field" style="margin-top:12px">
            <label for="card-desc">Description</label>
            <textarea class="input" id="card-desc" rows="8"
              placeholder="Add context, links, acceptance criteria…">${esc(card?.description ?? '')}</textarea>
          </div>
          <div class="field">
            <span class="field-label">Labels</span>
            <div class="label-toggles" id="card-labels">${labelMarkup}</div>
          </div>
          ${
            isNew
              ? ''
              : `<div class="card-meta">
                  <span>Created ${esc(formatDateTime(card.createdAt))}</span>
                  <span>Updated ${esc(formatDateTime(card.updatedAt))}</span>
                </div>`
          }
        </div>
        <aside class="card-side">
          <div class="field">
            <label for="card-column">Column</label>
            <select class="select" id="card-column">${columnOptions}</select>
          </div>
          <div class="field">
            <label for="card-priority">Priority</label>
            <select class="select" id="card-priority">${priorityOptions}</select>
          </div>
          <div class="field">
            <label for="card-due">Due date</label>
            <input class="input" type="date" id="card-due" value="${esc(card?.dueDate ?? '')}">
          </div>
          <div class="field">
            <label for="card-assignee">Assignee</label>
            <input class="input" id="card-assignee" list="assignee-options" placeholder="Unassigned"
                   value="${esc(card?.assignee ?? '')}" maxlength="80">
            <datalist id="assignee-options">${assigneeOptions}</datalist>
          </div>
        </aside>
      </div>
    </div>
    <div class="modal-foot">
      <div class="modal-foot-left">
        ${
          isNew
            ? ''
            : `<button class="btn ghost" data-act="archive">${icon('archive')}Archive</button>
               <button class="btn ghost danger-text" data-act="delete">${icon('trash')}Delete</button>`
        }
      </div>
      <div class="modal-foot-right">
        <button class="btn ghost" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="save">${isNew ? 'Create card' : 'Save changes'}</button>
      </div>
    </div>
    `,
    { className: isNew ? '' : '' },
  );

  const titleInput = $('#card-title', modal);

  const readForm = () => ({
    title: titleInput.value.trim(),
    description: $('#card-desc', modal).value,
    columnId: Number($('#card-column', modal).value),
    priority: $('#card-priority', modal).value,
    dueDate: $('#card-due', modal).value,
    assignee: $('#card-assignee', modal).value.trim(),
    labelIds: Array.from(selected),
  });

  const save = async () => {
    const payload = readForm();
    if (!payload.title) {
      toast('Give the card a title first', 'error');
      titleInput.focus();
      return;
    }
    const saveBtn = $('[data-act="save"]', modal);
    saveBtn.disabled = true;
    try {
      if (isNew) {
        await api('/cards', { method: 'POST', body: { ...payload, boardId: state.board.id } });
      } else {
        await api(`/cards/${card.id}`, { method: 'PATCH', body: payload });
      }
      closeModal();
      await refreshBoard();
      toast(isNew ? 'Card created' : 'Card saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
      saveBtn.disabled = false;
    }
  };

  modal.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action === 'cancel') closeModal();
    if (action === 'save') save();

    if (action === 'delete') {
      const btn = event.target.closest('[data-act="delete"]');
      if (btn.dataset.armed === '1') {
        try {
          await api(`/cards/${card.id}`, { method: 'DELETE' });
          closeModal();
          await refreshBoard();
          toast('Card deleted', 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      } else {
        btn.dataset.armed = '1';
        btn.innerHTML = `${icon('alert')}Click again to confirm`;
        setTimeout(() => {
          if (!btn.isConnected) return;
          btn.dataset.armed = '';
          btn.innerHTML = `${icon('trash')}Delete`;
        }, 3500);
      }
    }

    if (action === 'archive') {
      try {
        await api(`/cards/${card.id}`, { method: 'PATCH', body: { archived: true } });
        closeModal();
        await refreshBoard();
        toast('Card archived', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    const toggle = event.target.closest('[data-label-toggle]');
    if (toggle) {
      const labelId = Number(toggle.dataset.labelToggle);
      if (selected.has(labelId)) selected.delete(labelId);
      else selected.add(labelId);
      toggle.classList.toggle('on', selected.has(labelId));
      toggle.setAttribute('aria-pressed', String(selected.has(labelId)));
    }
  });

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  });

  titleInput.focus();
  titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);
}

/* ── Card actions ─────────────────────────────────────────────────────────── */

async function createCard(columnId, title) {
  const clean = String(title ?? '').trim();
  if (!clean) return false;
  try {
    await api('/cards', {
      method: 'POST',
      body: { boardId: state.board.id, columnId, title: clean },
    });
    state.quickAddValue = '';
    await refreshBoard();
    toast('Card added', 'success');
    return true;
  } catch (err) {
    toast(err.message, 'error');
    return false;
  }
}

async function persistOrder(columns) {
  const byId = new Map(state.cards.map((card) => [card.id, card]));
  for (const entry of columns) {
    entry.cardIds.forEach((id, position) => {
      const card = byId.get(id);
      if (card) {
        card.columnId = entry.columnId;
        card.position = position;
      }
    });
  }
  try {
    await api(`/boards/${state.board.id}/order`, { method: 'POST', body: { columns } });
    renderBoard();
    renderBoardHead();
    renderFilterbar();
  } catch (err) {
    toast(err.message, 'error');
    await loadBoard(state.board.id);
  }
}

/* ── Label manager ────────────────────────────────────────────────────────── */

function openLabelManager({ focusNew = false } = {}) {
  const rows = state.labels
    .map(
      (label) => `
      <div class="label-item" data-id="${label.id}">
        <input type="color" class="label-color" value="${esc(label.color)}" title="Label color" aria-label="Color for ${esc(label.name)}">
        <input class="input label-name" value="${esc(label.name)}" maxlength="60" aria-label="Label name">
        <span class="label-usage">${label.cardCount} card${label.cardCount === 1 ? '' : 's'}</span>
        <div class="label-actions">
          <button class="icon-btn" data-save aria-label="Save label" title="Save">${icon('check')}</button>
          <button class="icon-btn danger" data-delete aria-label="Delete label" title="Delete">${icon('trash')}</button>
        </div>
      </div>`,
    )
    .join('');

  const modal = openModal(
    `
    <div class="modal-head">
      <div>
        <h3>Global labels</h3>
        <p class="modal-sub">Categories shared across every board. Assign them to cards from the card editor.</p>
      </div>
      <button class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="label-create">
        <input type="color" id="new-label-color" value="#7c8cff" title="New label color" aria-label="New label color">
        <input class="input" id="new-label-name" placeholder="New label name…" maxlength="60">
        <button class="btn primary" id="btn-create-label">${icon('plus')}Add</button>
      </div>
      <div class="swatches">
        ${PALETTE.map(
          (color, index) =>
            `<button class="swatch ${index === 0 ? 'active' : ''}" data-color="${color}" style="--c:${color}" title="${color}" aria-label="Use color ${color}"></button>`,
        ).join('')}
      </div>
      <div class="label-list">${rows || '<p class="empty-note">No labels yet. Create one above.</p>'}</div>
    </div>
    <div class="modal-foot">
      <span class="modal-sub">Changes apply everywhere instantly.</span>
      <button class="btn ghost" data-act="close">Done</button>
    </div>
    `,
    { className: 'sm' },
  );

  const nameInput = $('#new-label-name', modal);
  const colorInput = $('#new-label-color', modal);

  modal.addEventListener('click', (event) => {
    const swatch = event.target.closest('.swatch');
    if (swatch) {
      colorInput.value = swatch.dataset.color;
      $$('.swatch', modal).forEach((item) => item.classList.toggle('active', item === swatch));
    }
  });

  const create = async () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    try {
      await api('/labels', { method: 'POST', body: { name, color: colorInput.value } });
      await refreshBoard();
      openLabelManager({ focusNew: true });
      toast('Label created', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  $('#btn-create-label', modal).addEventListener('click', create);
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      create();
    }
  });

  $('.label-list', modal)?.addEventListener('click', async (event) => {
    const row = event.target.closest('.label-item');
    if (!row) return;
    const id = Number(row.dataset.id);
    const nameInputRow = $('.label-name', row);
    const color = $('.label-color', row).value;
    const name = nameInputRow.value.trim();

    if (event.target.closest('[data-save]')) {
      if (!name) {
        toast('Label name cannot be empty', 'error');
        nameInputRow.focus();
        return;
      }
      try {
        await api(`/labels/${id}`, { method: 'PATCH', body: { name, color } });
        await refreshBoard();
        openLabelManager();
        toast('Label updated', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    if (event.target.closest('[data-delete]')) {
      const ok = await confirmDialog({
        title: 'Delete label?',
        message: `<strong>${esc(name)}</strong> will be removed from every card that uses it. This cannot be undone.`,
        confirmLabel: 'Delete label',
      });
      if (!ok) return;
      try {
        await api(`/labels/${id}`, { method: 'DELETE' });
        state.filters.labelIds.delete(id);
        await refreshBoard();
        openLabelManager();
        toast('Label deleted', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });

  $('.label-list', modal)?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !event.target.matches('.label-name')) return;
    event.preventDefault();
    const row = event.target.closest('.label-item');
    $('[data-save]', row)?.click();
  });

  $('.label-list', modal)?.addEventListener('change', async (event) => {
    if (!event.target.matches('.label-color')) return;
    const row = event.target.closest('.label-item');
    const id = Number(row.dataset.id);
    const name = $('.label-name', row).value.trim();
    if (!name) return;
    try {
      await api(`/labels/${id}`, { method: 'PATCH', body: { color: event.target.value } });
      await refreshBoard();
      openLabelManager();
      toast('Label color updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  if (focusNew) setTimeout(() => nameInput.focus(), 60);
}

/* ── Column modal ─────────────────────────────────────────────────────────── */

function openColumnModal(column = null) {
  if (!state.board) return;
  const isNew = !column;
  const modal = openModal(
    `
    <div class="modal-head">
      <div>
        <h3>${isNew ? 'New column' : 'Column settings'}</h3>
        <p class="modal-sub">${isNew ? 'Add another stage to your workflow.' : 'Rename, set a WIP limit or mark this stage as done.'}</p>
      </div>
      <button class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label for="column-name">Name</label>
        <input class="input" id="column-name" maxlength="80" value="${esc(column?.name ?? '')}" placeholder="e.g. In Progress">
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="column-color">Color</label>
          <input type="color" id="column-color" value="${esc(column?.color ?? '#7c8cff')}">
        </div>
        <div class="field">
          <label for="column-wip">WIP limit</label>
          <input class="input" id="column-wip" type="number" min="0" max="999" placeholder="No limit"
                 value="${column?.wipLimit != null ? column.wipLimit : ''}">
        </div>
      </div>
      <label class="check-row">
        <input type="checkbox" id="column-done" ${column?.isDone ? 'checked' : ''}>
        Count cards here as “done”
      </label>
      <p class="check-note">The board progress bar uses this flag. You can mark more than one column as done.</p>
    </div>
    <div class="modal-foot">
      <div class="modal-foot-left">
        ${
          isNew
            ? ''
            : `<button class="btn ghost danger-text" data-act="delete">${icon('trash')}Delete column</button>`
        }
      </div>
      <div class="modal-foot-right">
        <button class="btn ghost" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="save">${isNew ? 'Create column' : 'Save column'}</button>
      </div>
    </div>
    `,
    { className: 'sm' },
  );

  const read = () => ({
    name: $('#column-name', modal).value.trim(),
    color: $('#column-color', modal).value,
    wipLimit: $('#column-wip', modal).value === '' ? null : Number($('#column-wip', modal).value),
    isDone: $('#column-done', modal).checked,
  });

  modal.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action === 'cancel') closeModal();

    if (action === 'save') {
      const payload = read();
      if (!payload.name) {
        toast('Column name is required', 'error');
        $('#column-name', modal).focus();
        return;
      }
      try {
        if (isNew) {
          await api(`/boards/${state.board.id}/columns`, { method: 'POST', body: payload });
          toast('Column created', 'success');
        } else {
          await api(`/columns/${column.id}`, { method: 'PATCH', body: payload });
          toast('Column saved', 'success');
        }
        closeModal();
        await refreshBoard();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    if (action === 'delete') {
      const ok = await confirmDialog({
        title: 'Delete column?',
        message: `The column <strong>${esc(column.name)}</strong> and all of its cards will be permanently deleted.`,
        confirmLabel: 'Delete column',
      });
      if (!ok) return;
      try {
        await api(`/columns/${column.id}`, { method: 'DELETE' });
        closeModal();
        await refreshBoard();
        toast('Column deleted', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });

  setTimeout(() => $('#column-name', modal)?.focus(), 50);
}

/* ── Board modals ─────────────────────────────────────────────────────────── */

function openNewBoardModal() {
  const modal = openModal(
    `
    <div class="modal-head">
      <div><h3>New board</h3><p class="modal-sub">Start with three default columns — you can rename them later.</p></div>
      <button class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label for="board-name">Board name</label>
        <input class="input" id="board-name" maxlength="120" placeholder="e.g. Product launch">
      </div>
      <div class="field">
        <label for="board-desc">Description <span style="text-transform:none;letter-spacing:0">(optional)</span></label>
        <input class="input" id="board-desc" maxlength="255" placeholder="What is this board for?">
      </div>
      <div class="field">
        <label for="board-accent">Accent color</label>
        <input type="color" id="board-accent" value="#7c8cff">
      </div>
    </div>
    <div class="modal-foot">
      <div class="modal-foot-left"></div>
      <div class="modal-foot-right">
        <button class="btn ghost" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="create">Create board</button>
      </div>
    </div>
    `,
    { className: 'sm' },
  );

  const create = async () => {
    const name = $('#board-name', modal).value.trim();
    if (!name) {
      toast('Board name is required', 'error');
      $('#board-name', modal).focus();
      return;
    }
    const btn = $('[data-act="create"]', modal);
    btn.disabled = true;
    try {
      const { board } = await api('/boards', {
        method: 'POST',
        body: {
          name,
          description: $('#board-desc', modal).value.trim(),
          accent: $('#board-accent', modal).value,
        },
      });
      closeModal();
      await loadBoards();
      await loadBoard(board.id);
      toast('Board created', 'success');
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  };

  modal.addEventListener('click', (event) => {
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action === 'cancel') closeModal();
    if (action === 'create') create();
  });
  $('#board-name', modal).addEventListener('keydown', (event) => {
    if (event.key === 'Enter') create();
  });
  setTimeout(() => $('#board-name', modal)?.focus(), 50);
}

function openBoardSettings() {
  if (!state.board) return;
  const modal = openModal(
    `
    <div class="modal-head">
      <div><h3>Board settings</h3><p class="modal-sub">Rename the board, tweak its description or change the accent.</p></div>
      <button class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label for="board-name">Board name</label>
        <input class="input" id="board-name" maxlength="120" value="${esc(state.board.name)}">
      </div>
      <div class="field">
        <label for="board-desc">Description</label>
        <input class="input" id="board-desc" maxlength="255" value="${esc(state.board.description)}">
      </div>
      <div class="field">
        <label for="board-accent">Accent color</label>
        <input type="color" id="board-accent" value="${esc(state.board.accent)}">
      </div>
    </div>
    <div class="modal-foot">
      <div class="modal-foot-left">
        <button class="btn ghost danger-text" data-act="delete">${icon('trash')}Delete board</button>
      </div>
      <div class="modal-foot-right">
        <button class="btn ghost" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="save">Save changes</button>
      </div>
    </div>
    `,
    { className: 'sm' },
  );

  modal.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action === 'cancel') closeModal();

    if (action === 'save') {
      const name = $('#board-name', modal).value.trim();
      if (!name) {
        toast('Board name is required', 'error');
        return;
      }
      try {
        await api(`/boards/${state.board.id}`, {
          method: 'PATCH',
          body: {
            name,
            description: $('#board-desc', modal).value.trim(),
            accent: $('#board-accent', modal).value,
          },
        });
        closeModal();
        await refreshBoard();
        toast('Board saved', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    if (action === 'delete') {
      const ok = await confirmDialog({
        title: 'Delete board?',
        message: `The board <strong>${esc(state.board.name)}</strong> and all of its columns and cards will be permanently deleted. Global labels are kept.`,
        confirmLabel: 'Delete board',
      });
      if (!ok) return;
      try {
        await api(`/boards/${state.board.id}`, { method: 'DELETE' });
        closeModal();
        state.board = null;
        state.columns = [];
        state.cards = [];
        await loadBoards();
        if (state.boards[0]) await loadBoard(state.boards[0].id);
        else renderAll();
        toast('Board deleted', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });

  setTimeout(() => $('#board-name', modal)?.focus(), 50);
}

/* ── Archive modal ────────────────────────────────────────────────────────── */

function openArchive() {
  if (!state.board) return;
  const columnNames = new Map(state.columns.map((column) => [column.id, column.name]));
  const archived = state.cards
    .filter((card) => card.archived)
    .sort((a, b) => b.id - a.id);

  const rows = archived
    .map(
      (card) => `
      <div class="archive-item" data-id="${card.id}">
        <div class="archive-main">
          <div class="archive-title">${esc(card.title)}</div>
          <div class="archive-sub">${esc(columnNames.get(card.columnId) ?? 'Unknown column')}${
            card.dueDate ? ` · due ${esc(card.dueDate)}` : ''
          }</div>
        </div>
        <div class="archive-actions">
          <button class="btn ghost sm" data-restore="${card.id}">${icon('restore')}Restore</button>
          <button class="icon-btn danger" data-delete="${card.id}" title="Delete forever" aria-label="Delete forever">${icon('trash')}</button>
        </div>
      </div>`,
    )
    .join('');

  const modal = openModal(
    `
    <div class="modal-head">
      <div>
        <h3>Archived cards</h3>
        <p class="modal-sub">${archived.length} card${archived.length === 1 ? '' : 's'} hidden from the board.</p>
      </div>
      <button class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="modal-body">
      ${
        archived.length
          ? `<div class="archive-list">${rows}</div>`
          : '<p class="empty-note">Nothing archived yet.<br>Archive cards from the card editor to tidy your board.</p>'
      }
    </div>
    <div class="modal-foot">
      <div class="modal-foot-left"></div>
      <div class="modal-foot-right"><button class="btn ghost" data-act="close">Close</button></div>
    </div>
    `,
    { className: 'sm' },
  );

  modal.addEventListener('click', async (event) => {
    const restoreId = event.target.closest('[data-restore]')?.dataset.restore;
    if (restoreId) {
      try {
        await api(`/cards/${restoreId}`, { method: 'PATCH', body: { archived: false } });
        await refreshBoard();
        if (state.cards.some((card) => card.archived)) openArchive();
        else closeModal();
        toast('Card restored', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }

    const deleteId = event.target.closest('[data-delete]')?.dataset.delete;
    if (deleteId) {
      const card = state.cards.find((item) => item.id === Number(deleteId));
      const ok = await confirmDialog({
        title: 'Delete archived card?',
        message: `“<strong>${esc(card?.title ?? 'This card')}</strong>” will be permanently deleted.`,
        confirmLabel: 'Delete card',
      });
      if (!ok) return;
      try {
        await api(`/cards/${deleteId}`, { method: 'DELETE' });
        await refreshBoard();
        if (state.cards.some((item) => item.archived)) openArchive();
        else closeModal();
        toast('Card deleted', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });
}

/* ── Quick add ────────────────────────────────────────────────────────────── */

function openQuickAdd(columnId) {
  state.quickAdd = columnId;
  state.quickAddValue = '';
  renderBoard();
  setTimeout(() => {
    const textarea = $('.quick-add textarea', ui.board);
    if (textarea) textarea.focus();
  }, 20);
}

function closeQuickAdd() {
  state.quickAdd = null;
  state.quickAddValue = '';
  renderBoard();
}

/* ── Drag & drop ──────────────────────────────────────────────────────────── */

let dragPlaceholder = null;

function cleanupDrag() {
  const wasDragging = !!state.drag;
  state.drag = null;
  dragPlaceholder?.remove();
  dragPlaceholder = null;
  $$('.card.dragging', ui.board).forEach((card) => card.classList.remove('dragging'));
  $$('.column-body.drag-over', ui.board).forEach((body) => body.classList.remove('drag-over'));
  $$('.column.drag-target', ui.board).forEach((column) => column.classList.remove('drag-target'));
  if (wasDragging) {
    setTimeout(() => {
      state.suppressClick = false;
    }, 60);
  }
}

function afterElement(container, y) {
  const cards = $$('.card:not(.dragging)', container);
  let closest = null;
  let closestOffset = Number.NEGATIVE_INFINITY;
  for (const card of cards) {
    const box = card.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closestOffset) {
      closestOffset = offset;
      closest = card;
    }
  }
  return closest;
}

async function handleDrop(body) {
  const dragged = $('.card.dragging', ui.board);
  if (!dragged) {
    cleanupDrag();
    return;
  }
  if (dragPlaceholder && dragPlaceholder.parentElement === body) {
    body.insertBefore(dragged, dragPlaceholder);
  } else {
    body.appendChild(dragged);
  }

  const columns = $$('.column', ui.board).map((column) => ({
    columnId: Number(column.dataset.columnId),
    cardIds: $$('.column-body .card', column).map((card) => Number(card.dataset.cardId)),
  }));

  state.suppressClick = true;
  cleanupDrag();
  await persistOrder(columns);
}

/* ── Sidebar mobile ───────────────────────────────────────────────────────── */

function openSidebar() {
  ui.sidebar.classList.add('open');
  ui.scrim.classList.remove('hidden');
}

function closeSidebar() {
  ui.sidebar.classList.remove('open');
  ui.scrim.classList.add('hidden');
}

/* ── Init ─────────────────────────────────────────────────────────────────── */

function wireEvents() {
  // Login / logout
  ui.loginForm.addEventListener('submit', onLogin);
  ui.btnLogout.addEventListener('click', onLogout);

  // Sidebar
  ui.btnMenu.addEventListener('click', openSidebar);
  ui.btnSidebarClose.addEventListener('click', closeSidebar);
  ui.scrim.addEventListener('click', closeSidebar);
  ui.btnNewBoard.addEventListener('click', openNewBoardModal);
  ui.btnManageLabels.addEventListener('click', () => openLabelManager());

  ui.boardList.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-board-id]');
    if (btn) selectBoard(Number(btn.dataset.boardId));
  });

  ui.sideLabels.addEventListener('click', (event) => {
    const pill = event.target.closest('[data-label-filter]');
    if (pill) toggleLabelFilter(Number(pill.dataset.labelFilter));
  });

  // Topbar
  ui.btnBoardSettings.addEventListener('click', openBoardSettings);
  ui.btnNewCard.addEventListener('click', () => {
    openCardModal(null, state.columns[0]?.id ?? null);
  });

  // Filters
  let searchTimer = null;
  ui.filterQ.addEventListener('input', () => {
    state.filters.q = ui.filterQ.value.trim().toLowerCase();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      renderBoard();
      renderFilterbar();
    }, 120);
  });

  ui.btnLabelFilter.addEventListener('click', () => {
    state.labelMenuOpen = !state.labelMenuOpen;
    renderFilterbar();
  });

  ui.labelPopover.addEventListener('click', (event) => {
    const row = event.target.closest('[data-label-filter]');
    if (row) {
      toggleLabelFilter(Number(row.dataset.labelFilter));
      return;
    }
    if (event.target.closest('[data-clear-label-filter]')) {
      state.filters.labelIds.clear();
      renderAll();
    }
  });

  ui.filterAssignee.addEventListener('change', () => {
    state.filters.assignee = ui.filterAssignee.value;
    renderAll();
  });

  ui.filterPriority.addEventListener('change', () => {
    state.filters.priority = ui.filterPriority.value;
    renderAll();
  });

  ui.btnClearFilters.addEventListener('click', () => {
    state.filters = { q: '', labelIds: new Set(), assignee: '', priority: '' };
    renderAll();
  });

  ui.btnArchived.addEventListener('click', openArchive);

  // Board delegation
  ui.board.addEventListener('click', (event) => {
    if (state.suppressClick) return;

    const cardEl = event.target.closest('.card');
    if (cardEl) {
      openCardModal(Number(cardEl.dataset.cardId));
      return;
    }

    const openQuick = event.target.closest('[data-quick-open]');
    if (openQuick) {
      openQuickAdd(Number(openQuick.dataset.quickOpen));
      return;
    }

    if (event.target.closest('[data-quick-close]')) {
      closeQuickAdd();
      return;
    }

    if (event.target.closest('[data-quick-add]')) {
      createCard(state.quickAdd, state.quickAddValue).then(() => {
        const textarea = $('.quick-add textarea', ui.board);
        if (textarea) textarea.focus();
      });
      return;
    }

    const settingsBtn = event.target.closest('[data-col-settings]');
    if (settingsBtn) {
      const column = state.columns.find((item) => item.id === Number(settingsBtn.dataset.colSettings));
      if (column) openColumnModal(column);
      return;
    }

    if (event.target.closest('#btn-add-column') || event.target.closest('#empty-add-column')) {
      openColumnModal(null);
      return;
    }

    if (event.target.closest('#empty-create-board')) {
      openNewBoardModal();
    }
  });

  ui.board.addEventListener('input', (event) => {
    if (event.target.matches('.quick-add textarea')) state.quickAddValue = event.target.value;
  });

  ui.board.addEventListener('keydown', (event) => {
    if (event.target.matches('.quick-add textarea')) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        createCard(state.quickAdd, state.quickAddValue).then(() => {
          const textarea = $('.quick-add textarea', ui.board);
          if (textarea) textarea.focus();
        });
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeQuickAdd();
      }
      return;
    }

    if (event.key === 'Enter' && event.target.closest('.card')) {
      event.preventDefault();
      openCardModal(Number(event.target.closest('.card').dataset.cardId));
    }
  });

  // Drag & drop
  ui.board.addEventListener('dragstart', (event) => {
    const cardEl = event.target.closest('.card');
    if (!cardEl) return;
    if (filtersActive()) {
      event.preventDefault();
      return;
    }
    state.drag = { cardId: Number(cardEl.dataset.cardId) };
    cardEl.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    try {
      event.dataTransfer.setData('text/plain', cardEl.dataset.cardId);
    } catch {
      /* ignore */
    }
    state.suppressClick = true;
  });

  ui.board.addEventListener('dragover', (event) => {
    if (!state.drag) return;
    const body = event.target.closest('.column-body');
    if (!body) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (!dragPlaceholder) {
      dragPlaceholder = document.createElement('div');
      dragPlaceholder.className = 'drop-placeholder';
      const dragged = $('.card.dragging', ui.board);
      const height = dragged ? Math.round(dragged.getBoundingClientRect().height) : 72;
      dragPlaceholder.style.height = `${height}px`;
    }

    $$('.column-body', ui.board).forEach((item) => item.classList.toggle('drag-over', item === body));
    $$('.column', ui.board).forEach((column) =>
      column.classList.toggle('drag-target', column.contains(body)),
    );

    const after = afterElement(body, event.clientY);
    if (after) {
      if (dragPlaceholder.parentElement !== body || dragPlaceholder.nextElementSibling !== after) {
        body.insertBefore(dragPlaceholder, after);
      }
    } else if (dragPlaceholder.parentElement !== body || dragPlaceholder.nextElementSibling !== null) {
      body.appendChild(dragPlaceholder);
    }
  });

  ui.board.addEventListener('drop', (event) => {
    if (!state.drag) return;
    const body = event.target.closest('.column-body');
    if (!body) {
      cleanupDrag();
      return;
    }
    event.preventDefault();
    handleDrop(body);
  });

  ui.board.addEventListener('dragend', cleanupDrag);

  // Keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (ui.modalRoot.querySelector('.confirm-backdrop')) return;
      if (ui.modalRoot.querySelector('.modal')) {
        closeModal();
        return;
      }
      if (state.labelMenuOpen) {
        state.labelMenuOpen = false;
        renderFilterbar();
        return;
      }
      if (ui.sidebar.classList.contains('open')) {
        closeSidebar();
        return;
      }
    }

    if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === '/') {
      event.preventDefault();
      ui.filterQ.focus();
      ui.filterQ.select();
    }

    if (event.key.toLowerCase() === 'n' && state.board && !ui.modalRoot.querySelector('.modal')) {
      event.preventDefault();
      openCardModal(null, state.columns[0]?.id ?? null);
    }
  });

  // Close the label popover when clicking elsewhere
  document.addEventListener('click', (event) => {
    if (!state.labelMenuOpen) return;
    if (event.target.closest('#label-popover') || event.target.closest('#btn-label-filter')) return;
    state.labelMenuOpen = false;
    renderFilterbar();
  });

  // Poll gently for changes from other tabs
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (!state.board || state.drag) return;
    if (ui.modalRoot.querySelector('.modal')) return;
    if (isTyping(document.activeElement)) return;
    if (ui.sidebar.classList.contains('open')) return;
    loadBoard(state.board.id).catch(() => {});
  }, 30000);

  // Reclaim the screen size if the sidebar is open on mobile
  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) closeSidebar();
  });
}

function toggleLabelFilter(labelId) {
  if (state.filters.labelIds.has(labelId)) state.filters.labelIds.delete(labelId);
  else state.filters.labelIds.add(labelId);
  renderAll();
}

function init() {
  const ids = [
    'login', 'login-form', 'login-username', 'login-password', 'login-error', 'login-submit',
    'app', 'sidebar', 'scrim', 'board-list', 'side-labels', 'user-chip', 'btn-logout',
    'btn-new-board', 'btn-manage-labels', 'btn-menu', 'btn-sidebar-close',
    'board-head', 'topbar-actions', 'btn-board-settings', 'btn-new-card',
    'filterbar', 'filter-q', 'btn-label-filter', 'label-filter-count', 'label-popover',
    'filter-assignee', 'filter-priority', 'btn-archived', 'archived-count',
    'btn-clear-filters', 'view-hint', 'board', 'modal-root', 'toasts',
  ];
  for (const id of ids) {
    const key = id.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    ui[key] = document.getElementById(id);
  }

  wireEvents();
  boot().catch(() => showLogin());
}

async function boot() {
  try {
    const { user } = await api('/auth/me');
    state.user = user;
    ui.login.classList.add('hidden');
    ui.app.classList.remove('hidden');
    await enterApp();
  } catch {
    showLogin();
  }
}

init();
