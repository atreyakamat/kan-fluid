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
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.9-3.4 3.1-5.2 6-5.2s5.1 1.8 6 5.2"/><path d="M16 5.4a3.2 3.2 0 0 1 0 5.2M18 14.6c2 .7 3.2 2.5 3.7 5.4"/>',
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
  comment: '<path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H5l-2 2v-5.5A8.5 8.5 0 1 1 21 12Z"/><path d="M8.5 11.5h7M8.5 15h4.5"/>',
  send: '<path d="m21 3-7.5 18-3-7.5L3 10.5 21 3Z"/><path d="M10.5 13.5 16 8"/>',
  moon: '<path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  duplicate: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  chevronLeft: '<path d="m14 6-6 6 6 6"/>',
  chevronRight: '<path d="m10 6 6 6-6 6"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
  droplet:
    '<path d="M12 3c3.2 4 6 7.4 6 10.8a6 6 0 1 1-12 0C6 10.4 8.8 7 12 3Z"/><path d="M9.5 15.2c0 1.4 1 2.4 2.5 2.4" opacity=".6"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2.2"/><path d="M9 4v16"/>',
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
const VIEW_KEY = 'kan.view';
const THEME_KEY = 'kan.theme';
const SIDEBAR_KEY = 'kan.sidebar';
const CLIENT_ID =
  (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
  `c${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

const boardPan = { target: 0, raf: 0, last: 0 };

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;


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

const firstName = (name) => {
  const value = String(name ?? '').trim();
  if (!value) return 'Unknown';
  return value.split(/\s+/)[0];
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

const canManage = () => ['Owner', 'Admin'].includes(state.user?.role);

/* ── State ────────────────────────────────────────────────────────────────── */

const state = {
  user: null,
  boards: [],
  board: null,
  columns: [],
  cards: [],
  labels: [],
  activity: [],
  meta: { users: [], priorities: [] },
  filters: { q: '', labelIds: new Set(), assignee: '', priority: '' },
  quickAdd: null,
  quickAddValue: '',
  labelMenuOpen: false,
  drag: null,
  suppressClick: false,
  view: 'board',
  calMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  online: [],
  teamUsers: [],
  openCardId: null,
  events: null,
  refreshTimer: null,
  pendingRefresh: false,
  tour: { active: false, index: 0, steps: [] },
};

const ui = {};

/* ── API ──────────────────────────────────────────────────────────────────── */

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'X-Kan-Client': CLIENT_ID };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, {
    method,
    headers,
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
    if (res.status === 428) {
      if (state.user) {
        state.user.mustChangePassword = true;
        openPasswordModal({ forced: true });
      }
    }
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

/* ── Accent (per-board palette) ───────────────────────────────────────────── */

const DEFAULT_ACCENT = '#5eabdd';

const ACCENT_PRESETS = [
  { name: 'Sky', value: '#5eabdd' },
  { name: 'Blossom', value: '#f472b6' },
  { name: 'Mint', value: '#34d399' },
  { name: 'Amber', value: '#fbbf24' },
  { name: 'Lavender', value: '#a78bfa' },
  { name: 'Sunset', value: '#fb923c' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Slate', value: '#64748b' },
];

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  let value = hex.trim().replace(/^#/, '');
  if (value.length === 3) value = value.split('').map((ch) => ch + ch).join('');
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  const num = parseInt(value, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHsl({ r, g, b }) {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rf: h = (gf - bf) / d + (gf < bf ? 6 : 0); break;
      case gf: h = (bf - rf) / d + 2; break;
      default: h = (rf - gf) / d + 4;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hsl = (h, s, l) =>
  `hsl(${Number(h.toFixed(1))} ${clamp(s, 0, 100).toFixed(1)}% ${clamp(l, 0, 100).toFixed(1)}%)`;

const hsla = (h, s, l, a) =>
  `hsla(${Number(h.toFixed(1))} ${clamp(s, 0, 100).toFixed(1)}% ${clamp(l, 0, 100).toFixed(1)}% / ${a})`;

function relLuminance({ r, g, b }) {
  const f = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const [l1, l2] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function hslToRgb(h, s, l) {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lN - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

const THEME_MODES = ['light', 'dark', 'glass'];
const THEME_META = {
  light: { label: 'Light', sub: 'Glacier Sky', icon: 'sun', chrome: '#e8f5fe' },
  dark: { label: 'Dark', sub: 'True Black', icon: 'moon', chrome: '#000000' },
  glass: { label: 'Glass', sub: 'Refraction', icon: 'droplet', chrome: '#bfe4ff' },
};

function normalizeTheme(value) {
  return THEME_MODES.includes(value) ? value : 'light';
}

function currentTheme() {
  return normalizeTheme(document.documentElement.dataset.theme);
}

function accentPalette(hex, mode) {
  const base = hexToRgb(hex) ?? hexToRgb(DEFAULT_ACCENT);
  const { h, s } = rgbToHsl(base);
  const sat = clamp(s, 25, 92);
  const dark = mode === 'dark';
  const glass = mode === 'glass';

  const accentL = dark ? 68 : glass ? 54 : 56;
  const strongL = dark ? 74 : glass ? 40 : 42;
  const softL = dark ? 60 : glass ? 58 : 56;

  const primaryTop = hsl(h, sat, dark ? 78 : 82);
  const primaryMid = hsl(h, sat, dark ? 60 : 66);
  const primaryBottom = hsl(h, sat, dark ? 44 : 52);
  const primaryMidRgb = hslToRgb(h, sat, dark ? 60 : 66);
  const ink =
    contrast(primaryMidRgb, { r: 11, g: 53, b: 82 }) >=
    contrast(primaryMidRgb, { r: 255, g: 255, b: 255 })
      ? '#0b3552'
      : '#ffffff';

  // Backgrounds: dark is near-black (OLED-style) with only faint accent glow;
  // glass is vivid and saturated so frosted panels have real color to refract.
  let bgA;
  let bgB;
  let bgC;
  let bgD;
  let bgGlow;
  let bgGlow2;
  let orb2;
  let orb3;
  let orb4;

  if (dark) {
    const darkSat = Math.min(sat * 0.55, 34);
    bgA = hsl(h, darkSat, 2.5);
    bgB = hsl(h, darkSat, 3.2);
    bgC = hsl(h, darkSat, 4);
    bgD = hsl(h, darkSat * 0.8, 1.5);
    bgGlow = hsla(h, sat, 28, 0.16);
    bgGlow2 = hsla(h, sat, 22, 0.22);
    orb2 = hsl(h, sat, 20);
    orb3 = hsl(h, sat, 14);
    orb4 = hsl(h, sat, 17);
  } else if (glass) {
    bgA = hsl(h, Math.min(sat * 0.9, 78), 92);
    bgB = hsl(h, Math.min(sat * 1.05, 85), 82);
    bgC = hsl(h, Math.min(sat * 1.1, 90), 72);
    bgD = hsl(h, Math.min(sat * 1.1, 92), 62);
    bgGlow = hsla(h, sat, 82, 0.95);
    bgGlow2 = hsla(h, sat, 68, 0.9);
    orb2 = hsl(h, sat, 82);
    orb3 = hsl(h, sat, 92);
    orb4 = hsl(h, sat, 72);
  } else {
    bgA = hsl(h, Math.min(sat * 0.4, 55), 97);
    bgB = hsl(h, Math.min(sat * 0.55, 60), 94);
    bgC = hsl(h, Math.min(sat * 0.65, 65), 90);
    bgD = hsl(h, Math.min(sat * 0.7, 70), 85);
    bgGlow = hsla(h, sat, 78, 0.95);
    bgGlow2 = hsla(h, sat, 70, 0.85);
    orb2 = hsl(h, sat, 78);
    orb3 = hsl(h, sat, 90);
    orb4 = hsl(h, sat, 74);
  }

  return {
    '--accent': hsl(h, sat, accentL),
    '--accent-2': hsl(h, sat, dark ? 78 : 72),
    '--accent-strong': hsl(h, sat, strongL),
    '--accent-soft': hsla(h, sat, softL, dark ? 0.22 : glass ? 0.28 : 0.18),
    '--accent-ink': ink,
    '--accent-shadow': hsla(h, sat, dark ? 14 : 45, dark ? 0.9 : 0.85),
    '--accent-glow': hsla(h, sat, dark ? 40 : 62, dark ? 0.4 : 0.55),
    '--primary-1': primaryTop,
    '--primary-2': primaryMid,
    '--primary-3': primaryBottom,
    '--bg-a': bgA,
    '--bg-b': bgB,
    '--bg-c': bgC,
    '--bg-d': bgD,
    '--bg-glow': bgGlow,
    '--bg-glow-2': bgGlow2,
    '--orb-2': orb2,
    '--orb-3': orb3,
    '--orb-4': orb4,
  };
}

function applyAccent(hex) {
  const target = hex || state.board?.accent || DEFAULT_ACCENT;
  state.accent = target;
  const mode = currentTheme();
  const palette = accentPalette(target, mode);
  const root = document.documentElement.style;
  for (const [key, value] of Object.entries(palette)) {
    root.setProperty(key, value);
  }
}

function updateThemeIcon() {
  if (!ui.themeIcon) return;
  const mode = currentTheme();
  const meta = THEME_META[mode];
  ui.themeIcon.innerHTML = icon(meta.icon);
  if (ui.btnTheme) {
    const nextMode = THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length];
    const label = `${meta.label} mode — switch to ${THEME_META[nextMode].label}`;
    ui.btnTheme.title = label;
    ui.btnTheme.setAttribute('aria-label', label);
  }
  $$('[data-theme-choice]').forEach((btn) => {
    const on = btn.dataset.themeChoice === mode;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

function applyTheme(theme, { persist = true } = {}) {
  const next = normalizeTheme(theme);

  const run = () => {
    document.documentElement.dataset.theme = next;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_META[next].chrome);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    if (state.user) state.user.theme = next;
    applyAccent(state.board?.accent);
    updateThemeIcon();
  };

  // Smooth cross-fade on browsers that support the View Transitions API;
  // otherwise fall back to a brief, targeted CSS transition so the switch
  // never reads as an abrupt blink.
  if (typeof document.startViewTransition === 'function') {
    document.startViewTransition(run);
  } else {
    document.documentElement.classList.add('theme-anim');
    run();
    window.clearTimeout(applyTheme._t);
    applyTheme._t = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-anim');
    }, 650);
  }

  if (persist && state.user) {
    api('/auth/me', { method: 'PATCH', body: { theme: next } }).catch(() => {});
  }
}

function toggleTheme() {
  const mode = currentTheme();
  const next = THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length];
  applyTheme(next);
}

/* ── Presence ─────────────────────────────────────────────────────────────── */

function renderPresence() {
  if (!ui.presence) return;
  const users = state.online ?? [];
  if (!users.length) {
    ui.presence.innerHTML = '';
    ui.presence.classList.add('empty');
    ui.presence.title = 'No one else online';
    return;
  }
  ui.presence.classList.remove('empty');
  ui.presence.innerHTML = users
    .slice(0, 4)
    .map(
      (user) =>
        `<span class="avatar sm presence-avatar" style="--h:${hueOf(user.name)}" title="${esc(
          user.name,
        )} · ${esc(user.role)}">${esc(initials(user.name))}</span>`,
    )
    .join('');
  const extra = users.length - 4;
  if (extra > 0) ui.presence.innerHTML += `<span class="presence-more">+${extra}</span>`;
  ui.presence.title = `${users.length} online — ${users.map((user) => user.name).join(', ')}`;
  ui.presence.setAttribute('aria-label', ui.presence.title);
}

function openOnlineModal() {
  const users = state.online ?? [];
  const rows = users
    .map(
      (user) => `
      <div class="online-row">
        <span class="avatar sm" style="--h:${hueOf(user.name)}">${esc(initials(user.name))}</span>
        <div class="online-meta"><strong>${esc(user.name)}${user.id === state.user?.id ? ' (you)' : ''}</strong><span>${esc(user.role)}</span></div>
        <span class="online-dot" title="Online"></span>
      </div>`,
    )
    .join('');
  openModal(
    `
    <div class="modal-head">
      <div><h3>Who’s online</h3><p class="modal-sub">Live presence updates as teammates open Kan.</p></div>
      <button class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="online-list">${rows || '<p class="empty-note">No one is online right now.</p>'}</div>
    </div>
    <div class="modal-foot"><span class="modal-sub">${users.length} online</span><button class="btn ghost" data-act="close">Close</button></div>
    `,
    { className: 'sm' },
  );
}


function renderUser() {
  if (!state.user) return;
  ui.userChip.innerHTML = `
    <span class="avatar" style="--h:${hueOf(state.user.name)}">${esc(initials(state.user.name))}</span>
    <div class="user-meta"><strong>${esc(state.user.name)}</strong><span>${esc(state.user.role)}</span></div>`;
  ui.userChip.title = `Signed in as ${state.user.name} · ${state.user.role}`;
  const manager = canManage();
  ui.btnTeam?.classList.toggle('hidden', !manager);
  ui.sideTeamBlock?.classList.toggle('hidden', !manager);
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
  const scheduled = activeCards().filter(cardMatches).filter((card) => card.dueDate).length;
  $$('[data-view]', ui.viewToggle).forEach((btn) => {
    const on = btn.dataset.view === state.view;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  });
  if (flag) {
    ui.viewHint.textContent = `${visible}/${total} cards · drag paused while filtering`;
    ui.viewHint.classList.add('warn');
  } else if (state.view === 'calendar') {
    ui.viewHint.textContent = `${scheduled} scheduled · ${MONTHS[state.calMonth.getMonth()]}`;
    ui.viewHint.classList.remove('warn');
  } else {
    const label = `${total} card${total === 1 ? '' : 's'}`;
    ui.viewHint.textContent = label;
    ui.viewHint.classList.remove('warn');
    requestAnimationFrame(() => {
      if (state.view !== 'board' || !ui.board) return;
      if (boardMaxScroll() > 4) {
        ui.viewHint.textContent = `${label} · Shift + wheel, trackpad or ← → to pan`;
      }
    });
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
  const commentMarkup = card.commentCount
    ? `<span class="meta-chip comment-chip" title="${card.commentCount} comment${
        card.commentCount === 1 ? '' : 's'
      }">${icon('comment')}${card.commentCount}</span>`
    : '';
  const creatorName = card.createdByName || 'Unknown';
  const workingName = card.assignee || '';
  const creatorChip = `
    <span class="person-chip created" title="Created by ${esc(creatorName)}">
      <span class="person-avatar" style="--h:${hueOf(creatorName)}">${esc(initials(creatorName))}</span>
      <span class="person-text"><em>Created</em><strong>${esc(firstName(creatorName))}</strong></span>
    </span>`;
  const workingChip = workingName
    ? `<span class="person-chip working" title="Working on it: ${esc(workingName)}">
         <span class="person-avatar" style="--h:${hueOf(workingName)}">${esc(initials(workingName))}</span>
         <span class="person-text"><em>Working</em><strong>${esc(firstName(workingName))}</strong></span>
       </span>`
    : `<span class="person-chip working muted" title="No one assigned">
         <span class="person-avatar ghost">${icon('user')}</span>
         <span class="person-text"><em>Working</em><strong>Unassigned</strong></span>
       </span>`;

  return `
    <article class="card prio-${esc(card.priority)}" data-card-id="${card.id}"
             draggable="${filtersActive() ? 'false' : 'true'}" tabindex="0" role="button"
             aria-label="${esc(card.title)}">
      ${labelMarkup ? `<div class="card-labels">${labelMarkup}${
        extraLabels > 0 ? `<span class="chip" style="--c:#94a3b8">+${extraLabels}</span>` : ''
      }</div>` : ''}
      <h4 class="card-title">${esc(card.title)}</h4>
      ${card.description ? `<p class="card-desc">${esc(card.description)}</p>` : ''}
      <div class="card-people">
        ${creatorChip}
        ${workingChip}
      </div>
      <div class="card-foot">
        <div class="card-foot-left">
          <span class="prio-badge">${icon('flag')}${priority.label}</span>
          ${dueMarkup}
          ${commentMarkup}
        </div>
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

/* ── Horizontal board panning ─────────────────────────────────────────────── */

function boardMaxScroll() {
  return Math.max(0, ui.board.scrollWidth - ui.board.clientWidth);
}

function boardPanStep() {
  const max = boardMaxScroll();
  const target = Math.min(max, Math.max(0, boardPan.target));
  const current = ui.board.scrollLeft;
  const diff = target - current;
  if (Math.abs(diff) < 0.5) {
    ui.board.scrollLeft = target;
    boardPan.raf = 0;
    return;
  }
  ui.board.scrollLeft = current + diff * 0.24;
  boardPan.raf = requestAnimationFrame(boardPanStep);
}

function panBoardTo(left) {
  const max = boardMaxScroll();
  if (max <= 0) return;
  boardPan.target = Math.min(max, Math.max(0, left));
  boardPan.last = performance.now();
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ui.board.scrollLeft = boardPan.target;
    return;
  }
  if (!boardPan.raf) boardPan.raf = requestAnimationFrame(boardPanStep);
}

function panBoardBy(delta) {
  const max = boardMaxScroll();
  if (max <= 0 || !delta) return;
  const now = performance.now();
  if (now - boardPan.last > 450) boardPan.target = ui.board.scrollLeft;
  boardPan.last = now;
  panBoardTo(boardPan.target + delta);
}

function panBoardByColumn(direction) {
  const column = $('.column', ui.board);
  const step = column
    ? column.getBoundingClientRect().width + 15
    : Math.max(240, ui.board.clientWidth * 0.8);
  panBoardBy(direction * step);
}

function onBoardWheel(event) {
  if (state.view !== 'board') return;
  if (boardMaxScroll() <= 0) return;

  const scale =
    event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? Math.max(1, ui.board.clientWidth) : 1;
  const dx = (event.deltaX || 0) * scale;
  const dy = (event.deltaY || 0) * scale;
  // Shift + vertical wheel pans sideways; trackpads already send horizontal deltaX.
  const delta = event.shiftKey ? (Math.abs(dy) >= Math.abs(dx) ? dy : dx) : dx;
  if (!delta) return;
  if (!event.shiftKey && Math.abs(dx) <= Math.abs(dy)) return;

  event.preventDefault();
  panBoardBy(delta);
}

function handleBoardPanKeys(event) {
  if (state.view !== 'board') return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  if (ui.modalRoot.querySelector('.modal') || state.labelMenuOpen) return false;
  if (isTyping(event.target)) return false;
  if (boardMaxScroll() <= 0) return false;

  const inMain = event.target === document.body || !!event.target.closest?.('.main');
  if (!inMain) return false;

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    panBoardByColumn(event.key === 'ArrowRight' ? 1 : -1);
    return true;
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    panBoardTo(event.key === 'Home' ? 0 : boardMaxScroll());
    return true;
  }
  return false;
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
    ui.topbarActions.classList.remove('hidden');
    ui.btnBoardSettings?.classList.add('hidden');
    ui.btnNewCard?.classList.add('hidden');
    return;
  }

  ui.topbarActions.classList.remove('hidden');
  ui.btnBoardSettings?.classList.remove('hidden');
  ui.btnNewCard?.classList.remove('hidden');

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
  boardPan.target = scrollLeft;
  if (boardPan.raf) {
    cancelAnimationFrame(boardPan.raf);
    boardPan.raf = 0;
  }
  if (state.quickAdd && !ui.modalRoot.querySelector('.modal')) {
    const textarea = $('.quick-add textarea', ui.board);
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }
}

function carryForwardList() {
  const today = todayStr();
  const doneColumns = new Set(state.columns.filter((col) => col.isDone).map((col) => col.id));
  return activeCards()
    .filter(cardMatches)
    .filter((card) => card.dueDate && card.dueDate < today && !doneColumns.has(card.columnId))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}

function daysBetween(a, b) {
  const ms = toLocalDate(b).getTime() - toLocalDate(a).getTime();
  return Math.round(ms / 86400000);
}

function activityByDay() {
  const map = new Map();
  if (!Array.isArray(state.activity)) return map;
  for (const event of state.activity) {
    const key = String(event.createdAt).slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(event);
  }
  return map;
}

function renderCalendar() {
  if (!ui.calendar) return;
  const boardVisible = state.view !== 'calendar';
  ui.board.classList.toggle('hidden', !boardVisible || !state.board);
  ui.calendar.classList.toggle('hidden', boardVisible);

  if (!state.board) {
    ui.calendar.innerHTML = `
      <div class="board-empty">
        <div class="logo" aria-hidden="true"><i></i><i></i><i></i></div>
        <h2>No board to schedule yet</h2>
        <p>Create a board first, then due dates will appear on the calendar automatically.</p>
        <div class="empty-actions"><button class="btn primary" id="empty-create-board">${icon('plus')}Create a board</button></div>
      </div>`;
    return;
  }

  const month = state.calMonth;
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const today = todayStr();
  const doneColumns = new Set(state.columns.filter((col) => col.isDone).map((col) => col.id));

  const dueCards = activeCards().filter(cardMatches).filter((card) => card.dueDate);
  const byDate = new Map();
  for (const card of dueCards) {
    if (!byDate.has(card.dueDate)) byDate.set(card.dueDate, []);
    byDate.get(card.dueDate).push(card);
  }
  const activityDay = activityByDay();
  const inMonth = dueCards.filter((card) => card.dueDate.startsWith(monthKey));
  const completedInMonth = (state.activity || []).filter(
    (event) => event.type === 'completed' && String(event.createdAt).startsWith(monthKey),
  );
  const carry = carryForwardList();

  const first = new Date(year, monthIndex, 1);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - offset);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const key = dateKey(day);
    const items = (byDate.get(key) ?? []).sort(
      (a, b) => PRIORITY_KEYS.indexOf(a.priority) - PRIORITY_KEYS.indexOf(b.priority),
    );
    const dayEvents = activityDay.get(key) ?? [];
    const completedEvents = dayEvents.filter((e) => e.type === 'completed');
    const outside = day.getMonth() !== monthIndex;
    const dueMarkup = items
      .slice(0, 2)
      .map(
        (card) => `
        <button class="cal-item prio-${esc(card.priority)} ${doneColumns.has(card.columnId) ? 'done' : ''}"
                data-cal-card="${card.id}"
                title="${esc(card.title)} · ${esc(PRIORITIES[card.priority]?.label ?? '')}${
                  card.assignee ? ` · ${esc(card.assignee)}` : ''
                }">
          <i></i><span>${esc(card.title)}</span>
        </button>`,
      )
      .join('');
    const completedMarkup = completedEvents
      .slice(0, 2)
      .map(
        (event) => `
        <button class="cal-item done" data-cal-day="${esc(key)}" title="${esc(
          event.cardTitle || 'Completed',
        )} · completed by ${esc(event.userName || 'someone')}">
          ${icon('check')}<span>${esc(event.cardTitle || 'Completed')}</span>
        </button>`,
      )
      .join('');
    const extraCount =
      Math.max(0, items.length - 2) + Math.max(0, completedEvents.length - 2);
    const more = extraCount > 0 ? `<span class="cal-more">+${extraCount} more</span>` : '';
    const hasCarry = key === today && carry.length > 0;
    const hasEvents = items.length + dayEvents.length > 0;
    const dayCount = dayEvents.length;
    cells.push(`
      <div class="cal-day ${outside ? 'outside' : ''} ${key === today ? 'today' : ''} ${
        hasCarry ? 'has-carry' : ''
      } ${hasEvents ? 'has-events' : ''}" data-cal-day="${esc(key)}">
        <span class="cal-date">${day.getDate()}</span>
        <div class="cal-items">${dueMarkup}${completedMarkup}${more}</div>
        ${dayCount ? `<span class="cal-day-count">${dayCount}</span>` : ''}
      </div>`);
  }

  const filtered = filtersActive() ? ' · filtered' : '';
  const overdueCount = carry.length;

  const carryMarkup = overdueCount
    ? `<div class="cal-carry">
         <div class="cal-carry-head">
           <span>${icon('alert')} Carried forward from earlier days</span>
           <span class="pill">${overdueCount}</span>
         </div>
         <div class="cal-carry-list">${carry
           .slice(0, 10)
           .map(
             (card) => `
             <button class="cal-carry-item" data-cal-card="${card.id}" title="${esc(card.title)} · due ${esc(card.dueDate)}">
               <span class="person-avatar" style="--h:${hueOf(card.assignee || card.createdByName || 'Unknown')}; width:18px; height:18px; font-size:8px">${esc(initials(card.assignee || card.createdByName || '?'))}</span>
               <span>${esc(card.title)}</span>
               <span class="cal-carry-days">${daysBetween(card.dueDate, today)}d late</span>
             </button>`,
           )
           .join('')}</div>
       </div>`
    : '';

  ui.calendar.innerHTML = `
    <div class="cal-head">
      <div class="cal-title">
        <div class="board-eyebrow">${icon('calendar')}Schedule</div>
        <h3>${MONTHS[monthIndex]} ${year}</h3>
        <p>${inMonth.length} card${inMonth.length === 1 ? '' : 's'} due · ${completedInMonth.length} completed${
          overdueCount ? ` · <span class="cal-overdue">${overdueCount} carried forward</span>` : ''
        }${filtered}</p>
      </div>
      <div class="cal-nav">
        <button class="btn ghost sm" data-cal="today">Today</button>
        <button class="icon-btn" data-cal="prev" aria-label="Previous month">${icon('chevronLeft')}</button>
        <button class="icon-btn" data-cal="next" aria-label="Next month">${icon('chevronRight')}</button>
      </div>
    </div>
    ${carryMarkup}
    <div class="cal-weekdays">${WEEKDAYS.map((day) => `<span>${day}</span>`).join('')}</div>
    <div class="cal-grid">${cells.join('')}</div>`;
}

function openDayDetail(dateStr) {
  if (!dateStr) return;
  const date = toLocalDate(dateStr);
  const label = date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const activityDay = activityByDay().get(dateStr) ?? [];
  const dueCards = activeCards().filter((c) => c.dueDate === dateStr);
  const completed = activityDay.filter((e) => e.type === 'completed');
  const other = activityDay.filter((e) => e.type !== 'completed');
  const today = todayStr();
  const carry = dateStr === today ? carryForwardList() : [];

  const dueRow = (card) => `
    <li class="day-row" data-day-card="${card.id}">
      <span class="activity-dot">${icon('flag')}</span>
      <div class="day-row-main">
        <strong>${esc(card.title)}</strong>
        <small>${esc(PRIORITIES[card.priority]?.label ?? 'Medium')}${
          card.assignee ? ` · ${esc(card.assignee)}` : ''
        }</small>
      </div>
    </li>`;

  const completedRow = (event) => `
    <li class="day-row completed" data-day-card="${event.cardId ?? ''}">
      <span class="activity-dot" style="background:rgba(47,156,124,0.2); color:#228a6c;">${icon('check')}</span>
      <div class="day-row-main">
        <strong>${esc(event.cardTitle || 'Completed card')}</strong>
        <small>${esc(event.detail || 'Completed')} · ${esc(event.userName || 'someone')}</small>
      </div>
    </li>`;

  const otherRow = (event) => {
    const meta = ACTIVITY_META[event.type] ?? { icon: 'info', label: 'Change', tone: 'info' };
    return `
      <li class="day-row" data-day-card="${event.cardId ?? ''}">
        <span class="activity-dot">${icon(meta.icon)}</span>
        <div class="day-row-main">
          <strong>${esc(event.cardTitle || meta.label)}</strong>
          <small>${esc(event.detail || meta.label)} · ${esc(event.userName || 'someone')}</small>
        </div>
      </li>`;
  };

  const carryRow = (card) => `
    <li class="day-row carry" data-day-card="${card.id}">
      <span class="activity-dot" style="background:rgba(197,138,36,0.2); color:#a56e13;">${icon('alert')}</span>
      <div class="day-row-main">
        <strong>${esc(card.title)}</strong>
        <small>Due ${esc(card.dueDate)} · ${daysBetween(card.dueDate, today)} day${
          daysBetween(card.dueDate, today) === 1 ? '' : 's'
        } late${card.assignee ? ` · ${esc(card.assignee)}` : ''}</small>
      </div>
    </li>`;

  const section = (title, rows, empty) => `
    <div class="day-detail-section">
      <h4>${esc(title)}</h4>
      ${rows.length ? `<ul class="day-list">${rows.join('')}</ul>` : `<div class="day-detail-empty">${esc(empty)}</div>`}
    </div>`;

  const modal = openModal(
    `
    <div class="modal-head day-detail">
      <div><h3>${esc(label)}</h3><p class="modal-sub">A snapshot of what was planned and what moved.</p></div>
      <button class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="modal-body">
      ${section(`Due (${dueCards.length})`, dueCards.map(dueRow), 'Nothing was scheduled for this day.')}
      ${section(`Completed (${completed.length})`, completed.map(completedRow), 'No tasks were completed on this day.')}
      ${carry.length ? section(`Carried forward (${carry.length})`, carry.map(carryRow), '') : ''}
      ${section(`Activity (${other.length})`, other.map(otherRow), 'No other activity logged.')}
    </div>
    <div class="modal-foot">
      <div class="modal-foot-left"></div>
      <div class="modal-foot-right">
        <button class="btn ghost" data-act="close">Close</button>
      </div>
    </div>`,
    { className: 'sm' },
  );
  modal.addEventListener('click', (event) => {
    const cardId = event.target.closest('[data-day-card]')?.dataset.dayCard;
    if (cardId) {
      const id = Number(cardId);
      if (id) {
        closeModal();
        openCardModal(id);
      }
    }
  });
}

function renderAll() {
  renderUser();
  renderSidebar();
  renderBoardHead();
  renderFilterbar();
  if (state.view === 'calendar') renderCalendar();
  else {
    ui.calendar?.classList.add('hidden');
    ui.board?.classList.remove('hidden');
    renderBoard();
  }
  renderPresence();
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
  state.activity = Array.isArray(data.activity) ? data.activity : [];
  if (!state.columns.some((column) => column.id === state.quickAdd)) state.quickAdd = null;
  for (const labelId of Array.from(state.filters.labelIds)) {
    if (!state.labels.some((label) => label.id === labelId)) state.filters.labelIds.delete(labelId);
  }
  try {
    localStorage.setItem(BOARD_KEY, String(id));
  } catch {
    /* ignore */
  }
  applyAccent(state.board?.accent);
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

/* ── Live updates ─────────────────────────────────────────────────────────── */

function scheduleRemoteRefresh(task) {
  if (state.refreshTimer) clearTimeout(state.refreshTimer);
  const run = () => {
    state.refreshTimer = null;
    if (state.drag) {
      state.pendingRefresh = true;
      return;
    }
    task().catch(() => {});
  };
  state.refreshTimer = setTimeout(run, 220);
}

async function reloadAvatarDetails() {
  await loadMeta();
  renderFilterbar();
}

function handleEvent(payload) {
  if (!payload || typeof payload !== 'object') return;
  if (payload.type === 'hello' || payload.type === 'presence') {
    state.online = Array.isArray(payload.users) ? payload.users : [];
    renderPresence();
    return;
  }
  if (payload.type === 'comment') {
    if (state.openCardId && Number(payload.cardId) === state.openCardId) {
      const modal = ui.modalRoot.querySelector('.modal');
      if (modal) loadComments(state.openCardId, modal);
    }
    if (state.board && Number(payload.boardId) === state.board.id) {
      scheduleRemoteRefresh(async () => {
        await loadBoard(state.board.id);
        if (state.openCardId) {
          const modal = ui.modalRoot.querySelector('.modal');
          if (modal && $('#comment-list', modal)) loadComments(state.openCardId, modal);
        }
      });
    }
    return;
  }

  if (payload.type !== 'change') return;
  const scope = payload.scope;
  const actor = payload.actor?.name;

  if (scope === 'boards') {
    scheduleRemoteRefresh(async () => {
      await loadBoards();
      if (state.board && !state.boards.some((board) => board.id === state.board.id)) {
        const next = state.boards[0];
        if (next) await loadBoard(next.id);
        else {
          state.board = null;
          renderAll();
        }
      } else {
        renderSidebar();
        renderBoardHead();
      }
      if (actor) toast(`${actor} updated the boards`, 'info');
    });
    return;
  }

  if (scope === 'users') {
    scheduleRemoteRefresh(reloadAvatarDetails);
    return;
  }

  if (scope === 'labels') {
    scheduleRemoteRefresh(async () => {
      if (state.board) await loadBoard(state.board.id);
      else {
        const { labels } = await api('/labels');
        state.labels = labels;
        renderAll();
      }
    });
    return;
  }

  if (scope === 'board') {
    if (!state.board || Number(payload.boardId) !== state.board.id) {
      scheduleRemoteRefresh(loadBoards);
      return;
    }
    scheduleRemoteRefresh(async () => {
      await loadBoard(state.board.id);
      if (state.openCardId) {
        const modal = ui.modalRoot.querySelector('.modal');
        if (modal && $('#comment-list', modal)) loadComments(state.openCardId, modal);
      }
    });
  }
}

function connectEvents() {
  disconnectEvents();
  if (!state.user || typeof EventSource === 'undefined') return;
  const source = new EventSource(`/api/events?client=${encodeURIComponent(CLIENT_ID)}`);
  state.events = source;
  source.onmessage = (event) => {
    if (!event.data) return;
    try {
      handleEvent(JSON.parse(event.data));
    } catch {
      /* ignore malformed frames */
    }
  };
  source.onerror = () => {
    if (source.readyState === EventSource.CLOSED) return;
    state.online = [];
    renderPresence();
  };
}

function disconnectEvents() {
  if (state.events) {
    state.events.close();
    state.events = null;
  }
  if (state.refreshTimer) {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = null;
  }
  state.online = [];
}

/* ── Auth / boot ──────────────────────────────────────────────────────────── */

function resetWorkspaceState() {
  state.boards = [];
  state.board = null;
  state.columns = [];
  state.cards = [];
  state.labels = [];
  state.activity = [];
  state.filters = { q: '', labelIds: new Set(), assignee: '', priority: '' };
  state.quickAdd = null;
  state.quickAddValue = '';
  state.labelMenuOpen = false;
  state.openCardId = null;
  state.online = [];
  state.pendingRefresh = false;
  applyAccent(null);
}

function showLogin() {
  disconnectEvents();
  if (state.tour.active) endTour(false);
  closeModal(true);
  state.user = null;
  resetWorkspaceState();
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
  if (state.user) toast('Your session ended — please sign in again.', 'error');
  showLogin();
}

function showAppShell() {
  ui.login.classList.add('hidden');
  ui.app.classList.remove('hidden');
}

function restoreView() {
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    state.view = stored === 'calendar' ? 'calendar' : 'board';
  } catch {
    state.view = 'board';
  }
}

async function enterApp() {
  renderUser();
  restoreView();
  const preferred = state.user?.theme === 'dark' ? 'dark' : 'light';
  applyTheme(preferred, { persist: false });
  updateThemeIcon();

  if (state.user?.mustChangePassword) {
    openPasswordModal({ forced: true });
    return;
  }

  try {
    await Promise.all([loadMeta(), loadBoards()]);
  } catch (err) {
    if (err.message !== 'Set a new password before continuing' && !state.user?.mustChangePassword) {
      toast(err.message, 'error');
    }
    return;
  }
  if (state.user?.mustChangePassword) {
    openPasswordModal({ forced: true });
    return;
  }

  connectEvents();

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

  if (!state.user.onboarded) {
    openOnboarding();
  } else if (!state.user.tourCompleted) {
    setTimeout(() => {
      if (state.user && !state.tour.active && !state.user.tourCompleted) startTour();
    }, 500);
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
    ui.loginPassword.value = '';
    showAppShell();
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

function closeModal(force = false) {
  if (!force && ui.modalRoot.querySelector('.modal.locked')) return;
  const existing = ui.modalRoot.querySelector('.modal');
  if (existing && typeof existing._onClose === 'function') {
    try {
      existing._onClose();
    } catch {
      /* ignore */
    }
  }
  ui.modalRoot.innerHTML = '';
  state.openCardId = null;
  document.body.classList.remove('modal-open');
}

function openModal(html, { className = '', locked = false, onClose = null } = {}) {
  closeModal(true);
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal ${className} ${locked ? 'locked' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  ui.modalRoot.appendChild(wrap);
  document.body.classList.add('modal-open');
  const modal = wrap.querySelector('.modal');
  if (onClose) modal._onClose = onClose;

  wrap.addEventListener('mousedown', (event) => {
    if (locked) return;
    if (event.target === wrap) closeModal();
  });
  wrap.addEventListener('click', (event) => {
    if (locked) return;
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

/* ── Password & onboarding ────────────────────────────────────────────────── */

async function patchMe(body) {
  const { user } = await api('/auth/me', { method: 'PATCH', body });
  state.user = user;
  renderUser();
  return user;
}

function openPasswordModal({ forced = false } = {}) {
  if (ui.modalRoot.querySelector('#password-form')) return;
  const modal = openModal(
    `
    <div class="modal-head">
      <div>
        <h3>${forced ? 'Set a new password' : 'Change password'}</h3>
        <p class="modal-sub">${
          forced
            ? 'Your temporary password works once. Choose your own to unlock the workspace.'
            : 'Use at least 8 characters. You’ll stay signed in on this device.'
        }</p>
      </div>
      ${forced ? '' : `<button class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button>`}
    </div>
    <div class="modal-body">
      ${
        forced
          ? `<div class="notice"><span class="notice-icon">${icon('lock')}</span><div><strong>First sign-in</strong><p>For safety, every new account starts with a temporary password. This is the only step required before you can use Kan.</p></div></div>`
          : ''
      }
      <form id="password-form" novalidate>
        <div class="field">
          <label for="pw-current">${forced ? 'Temporary password' : 'Current password'}</label>
          <input class="input" id="pw-current" type="password" autocomplete="current-password" required>
        </div>
        <div class="field">
          <label for="pw-new">New password</label>
          <input class="input" id="pw-new" type="password" autocomplete="new-password" minlength="8" required>
        </div>
        <div class="field">
          <label for="pw-confirm">Confirm new password</label>
          <input class="input" id="pw-confirm" type="password" autocomplete="new-password" minlength="8" required>
        </div>
        <p class="form-error" id="pw-error" role="alert"></p>
      </form>
    </div>
    <div class="modal-foot">
      <div class="modal-foot-left">${forced ? '<span class="modal-sub">You can’t skip this step.</span>' : ''}</div>
      <div class="modal-foot-right">
        ${forced ? '' : '<button class="btn ghost" data-act="close">Cancel</button>'}
        <button class="btn primary" id="pw-submit" type="submit" form="password-form">Save password</button>
      </div>
    </div>
    `,
    { className: 'sm', locked: forced },
  );

  const form = $('#password-form', modal);
  const error = $('#pw-error', modal);
  const submit = $('#pw-submit', modal);
  const current = $('#pw-current', modal);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentPassword = current.value;
    const newPassword = $('#pw-new', modal).value;
    const confirm = $('#pw-confirm', modal).value;
    error.textContent = '';
    if (!currentPassword) {
      error.textContent = 'Enter your current password.';
      current.focus();
      return;
    }
    if (newPassword.length < 8) {
      error.textContent = 'Use at least 8 characters.';
      $('#pw-new', modal).focus();
      return;
    }
    if (newPassword !== confirm) {
      error.textContent = 'The new passwords do not match.';
      $('#pw-confirm', modal).focus();
      return;
    }
    submit.disabled = true;
    try {
      const { user } = await api('/auth/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      state.user = user;
      closeModal(true);
      toast('Password updated', 'success');
      if (forced) await enterApp();
    } catch (err) {
      error.textContent = err.message;
      submit.disabled = false;
    }
  });

  setTimeout(() => current.focus(), 50);
}

async function finishOnboarding({ tour = false } = {}) {
  try {
    await patchMe({ onboarded: true, ...(tour ? {} : { tourCompleted: true }) });
  } catch {
    /* keep going */
  }
  closeModal(true);
  if (tour) startTour();
}

function onboardingTeamForm() {
  const owner = state.user?.role === 'Owner';
  return `
    <div class="onboard-team">
      <div class="onboard-team-head">
        <strong>Invite a teammate</strong>
        <span>Temporary password — they’ll change it on first sign-in.</span>
      </div>
      <form class="onboard-form" id="onboard-create">
        <input class="input" id="onboard-name" placeholder="Full name" maxlength="80" required>
        <input class="input" id="onboard-username" placeholder="username" maxlength="60" autocapitalize="none" spellcheck="false" required>
        <input class="input" id="onboard-password" type="text" placeholder="Temp password (8+ chars)" minlength="8" required>
        <select class="select" id="onboard-role" aria-label="Role">
          <option value="Member">Member</option>
          <option value="Admin">Admin</option>
          ${owner ? '<option value="Owner">Owner</option>' : ''}
        </select>
        <button class="btn primary sm" type="submit">${icon('plus')}Add</button>
      </form>
      <div id="onboard-created" class="onboard-created"></div>
    </div>`;
}

function openOnboarding() {
  if (!state.user || ui.modalRoot.querySelector('#onboard-modal')) return;
  const manager = canManage();
  const firstName = String(state.user.name).split(/\s+/)[0] || 'there';
  const modal = openModal(
    `
    <div class="onboard-wrap" id="onboard-modal">
      <div class="onboard-hero">
        <span class="onboard-spark">${icon('sparkle')}</span>
        <div>
          <div class="board-eyebrow">Welcome to Kan</div>
          <h2>You’re in, ${esc(firstName)}.</h2>
          <p>${manager ? 'Your workspace is ready. Bring your team in, then take the two-minute tour.' : 'Your workspace is ready. Here’s how to get the most out of your first day.'}</p>
        </div>
      </div>
      <div class="onboard-steps">
        <div class="onboard-step done"><span>1</span><div><strong>Password secured</strong><p>Your account is ready to use.</p></div><em>${icon('check')}</em></div>
        <div class="onboard-step"><span>2</span><div><strong>${manager ? 'Build your team' : 'Find your board'}</strong><p>${manager ? 'Add teammates with a temporary password. You can do this any time.' : 'Open the sidebar to switch boards, filter cards and see what’s due.'}</p></div></div>
        <div class="onboard-step"><span>3</span><div><strong>Take the tour</strong><p>Boards, labels, calendar, comments and shortcuts — in under two minutes.</p></div></div>
      </div>
      ${manager ? onboardingTeamForm() : ''}
    </div>
    `,
    { className: 'onboard' },
  );

  modal.addEventListener('click', async (event) => {
    if (event.target.closest('[data-onboard="tour"]')) finishOnboarding({ tour: true });
    if (event.target.closest('[data-onboard="later"]')) finishOnboarding();
  });

  const createForm = $('#onboard-create', modal);
  createForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = $('#onboard-name', modal).value.trim();
    const username = $('#onboard-username', modal).value.trim().toLowerCase();
    const password = $('#onboard-password', modal).value;
    const role = $('#onboard-role', modal).value;
    const btn = $('button[type="submit"]', createForm);
    btn.disabled = true;
    try {
      const { user } = await api('/users', {
        method: 'POST',
        body: { name, username, password, role },
      });
      const created = $('#onboard-created', modal);
      created.innerHTML += `<span class="created-pill"><span class="avatar sm" style="--h:${hueOf(
        user.name,
      )}">${esc(initials(user.name))}</span>${esc(user.name)} · @${esc(user.username)}</span>`;
      createForm.reset();
      toast(`${user.name} added`, 'success');
      await loadMeta();
      renderFilterbar();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  modal.querySelector('.modal-foot')?.remove();
  const foot = document.createElement('div');
  foot.className = 'onboard-foot';
  foot.innerHTML = `
    <button class="btn ghost" data-onboard="later">Skip for now</button>
    <button class="btn primary" data-onboard="tour">${icon('sparkle')}Take the tour</button>`;
  modal.appendChild(foot);
}

/* ── Guided tour ──────────────────────────────────────────────────────────── */

const TOUR_STEPS = [
  {
    target: '[data-tour="boards"]',
    title: 'Your boards live here',
    body: 'Every board is its own flow. Switch boards from the sidebar, or create another one for a different project.',
    placement: 'right',
  },
  {
    target: '[data-tour="new-board"]',
    title: 'Start a new board',
    body: 'Spin up a board in seconds. It arrives with Backlog, In Progress and Done columns, ready to rename.',
    placement: 'right',
  },
  {
    target: '[data-tour="labels"]',
    title: 'Labels work everywhere',
    body: 'Global labels categorise cards across every board. Click one to filter instantly.',
    placement: 'right',
  },
  {
    target: '[data-tour="search"]',
    title: 'Find any card',
    body: 'Search titles, descriptions, assignees and labels. Press / from anywhere to jump here.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="filters"]',
    title: 'Slice the work',
    body: 'Filter by label, assignee or priority. Filters also apply to the calendar view.',
    placement: 'bottom',
  },
  {
    target: '#view-toggle',
    title: 'Board or calendar',
    body: 'Switch to Calendar to see everything with a due date. Priorities become colours, and overdue work stands out.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="new-card"]',
    title: 'Capture work',
    body: 'Add a card, then open it to set a priority, due date, assignee, labels and a discussion thread.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="theme"]',
    title: 'Light or dark',
    body: 'Glacier Sky has a deep-night counterpart. Your choice is saved to your account.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="account"]',
    title: 'Your account',
    body: 'Update your name, change your password, replay this tour, or open Team & access if you’re an admin.',
    placement: 'top',
  },
];

let tourKeyHandler = null;

function tourPosition() {
  const root = $('#tour-root');
  if (!root || !state.tour.active) return;
  const step = state.tour.steps[state.tour.index];
  if (!step) return;
  const spot = $('.tour-spot', root);
  const tip = $('.tour-tip', root);
  let target = document.querySelector(step.target);
  if (target && target.closest('.sidebar') && window.innerWidth <= 980) {
    openSidebar();
    target = document.querySelector(step.target);
  }
  if (!target) {
    spot.style.display = 'none';
    tip.style.left = '50%';
    tip.style.top = '50%';
    tip.style.transform = 'translate(-50%, -50%)';
    return;
  }
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    spot.style.display = 'none';
    tip.style.left = '50%';
    tip.style.top = '50%';
    tip.style.transform = 'translate(-50%, -50%)';
    return;
  }
  const pad = 7;
  spot.style.display = 'block';
  spot.style.left = `${rect.left - pad}px`;
  spot.style.top = `${rect.top - pad}px`;
  spot.style.width = `${rect.width + pad * 2}px`;
  spot.style.height = `${rect.height + pad * 2}px`;

  const tipWidth = Math.min(330, window.innerWidth - 32);
  tip.style.width = `${tipWidth}px`;
  tip.style.transform = 'none';
  let left;
  let top;
  if (step.placement === 'right' && rect.right + tipWidth + 20 < window.innerWidth) {
    left = rect.right + 16;
    top = rect.top + Math.min(0, (rect.height - 190) / 2);
  } else if (step.placement === 'top' && rect.top > 230) {
    left = rect.left + rect.width / 2 - tipWidth / 2;
    top = rect.top - 206;
  } else {
    left = rect.left + rect.width / 2 - tipWidth / 2;
    top = rect.bottom + 14;
    if (top + 220 > window.innerHeight) top = Math.max(16, rect.top - 220);
  }
  left = Math.max(16, Math.min(left, window.innerWidth - tipWidth - 16));
  top = Math.max(16, Math.min(top, window.innerHeight - 230));
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function renderTourStep() {
  if (!state.tour.active) return;
  if (state.tour.index >= state.tour.steps.length) {
    endTour(true);
    return;
  }
  const step = state.tour.steps[state.tour.index];
  const root = $('#tour-root');
  const last = state.tour.index === state.tour.steps.length - 1;
  root.innerHTML = `
    <div class="tour-layer">
      <div class="tour-spot"></div>
      <div class="tour-tip" role="dialog" aria-modal="true" aria-label="${esc(step.title)}">
        <div class="tour-progress"><span>Step ${state.tour.index + 1} of ${state.tour.steps.length}</span><button class="text-btn" data-tour-action="skip">Skip tour</button></div>
        <h3>${esc(step.title)}</h3>
        <p>${esc(step.body)}</p>
        <div class="tour-actions">
          <button class="btn ghost sm ${state.tour.index === 0 ? 'hidden' : ''}" data-tour-action="prev">Back</button>
          <button class="btn primary sm" data-tour-action="next">${last ? 'Finish' : 'Next'}${last ? icon('check') : icon('arrow')}</button>
        </div>
        <div class="tour-dots">${state.tour.steps
          .map((_, index) => `<span class="${index === state.tour.index ? 'on' : ''}"></span>`)
          .join('')}</div>
      </div>
    </div>`;
  requestAnimationFrame(tourPosition);
}

function startTour() {
  if (!state.user) return;
  if (state.tour.active) return;
  state.tour = { active: true, index: 0, steps: TOUR_STEPS };
  const root = $('#tour-root');
  root.addEventListener('click', onTourClick);
  tourKeyHandler = (event) => {
    if (!state.tour.active) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      endTour(true);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      tourNext();
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      tourPrev();
    }
  };
  document.addEventListener('keydown', tourKeyHandler, true);
  window.addEventListener('resize', tourPosition);
  window.addEventListener('scroll', tourPosition, true);
  renderTourStep();
}

function onTourClick(event) {
  const action = event.target.closest('[data-tour-action]')?.dataset.tourAction;
  if (action === 'skip') endTour(true);
  if (action === 'next') tourNext();
  if (action === 'prev') tourPrev();
}

function tourNext() {
  state.tour.index += 1;
  if (state.tour.index >= state.tour.steps.length) endTour(true);
  else renderTourStep();
}

function tourPrev() {
  state.tour.index = Math.max(0, state.tour.index - 1);
  renderTourStep();
}

async function endTour(mark = true) {
  if (!state.tour.active) return;
  state.tour.active = false;
  const root = $('#tour-root');
  root.removeEventListener('click', onTourClick);
  root.innerHTML = '';
  if (tourKeyHandler) document.removeEventListener('keydown', tourKeyHandler, true);
  tourKeyHandler = null;
  window.removeEventListener('resize', tourPosition);
  window.removeEventListener('scroll', tourPosition, true);
  if (window.innerWidth <= 980) closeSidebar();
  if (mark && state.user && !state.user.tourCompleted) {
    try {
      await patchMe({ tourCompleted: true });
    } catch {
      /* ignore */
    }
  }
}

/* ── Account centre ───────────────────────────────────────────────────────── */

function openAccountModal() {
  if (!state.user) return;
  const currentMode = currentTheme();
  const modal = openModal(
    `
    <div class="account-hero">
      <span class="avatar lg" style="--h:${hueOf(state.user.name)}">${esc(initials(state.user.name))}</span>
      <div>
        <div class="board-eyebrow">Signed in</div>
        <h3>${esc(state.user.name)}</h3>
        <p>@${esc(state.user.username)} · ${esc(state.user.role)}</p>
      </div>
      <button class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="modal-body account-body">
      <div class="account-section">
        <span class="field-label">Display name</span>
        <div class="account-name">
          <input class="input" id="account-name" maxlength="80" value="${esc(state.user.name)}">
          <button class="btn ghost sm" id="account-save-name">Save</button>
        </div>
      </div>
      <div class="account-section">
        <span class="field-label">Appearance</span>
        <div class="theme-choice">
          ${THEME_MODES.map(
            (mode) => `
            <button class="theme-option ${currentMode === mode ? 'on' : ''}" data-theme-choice="${mode}" aria-pressed="${currentMode === mode}">${icon(
              THEME_META[mode].icon,
            )}<span>${THEME_META[mode].label}</span><em>${THEME_META[mode].sub}</em></button>`,
          ).join('')}
        </div>
      </div>
      <div class="account-actions">
        <button class="account-action" data-account="password">${icon('lock')}<span><strong>Change password</strong><em>Stay signed in, protect your account.</em></span>${icon('arrow')}</button>
        <button class="account-action" data-account="tour">${icon('sparkle')}<span><strong>Replay the tour</strong><em>Boards, calendar, comments and shortcuts.</em></span>${icon('arrow')}</button>
        ${
          canManage()
            ? `<button class="account-action" data-account="team">${icon('users')}<span><strong>Team &amp; access</strong><em>Add people, reset passwords, manage roles.</em></span>${icon('arrow')}</button>`
            : ''
        }
        <button class="account-action danger-text" data-account="logout">${icon('logout')}<span><strong>Sign out</strong><em>End this session on this device.</em></span>${icon('arrow')}</button>
      </div>
    </div>
    `,
    { className: 'sm account' },
  );

  modal.addEventListener('click', async (event) => {
    const themeChoice = event.target.closest('[data-theme-choice]');
    if (themeChoice) {
      applyTheme(themeChoice.dataset.themeChoice);
      return;
    }
    const action = event.target.closest('[data-account]')?.dataset.account;
    if (action === 'password') {
      closeModal(true);
      openPasswordModal();
    }
    if (action === 'tour') {
      closeModal(true);
      startTour();
    }
    if (action === 'team') {
      closeModal(true);
      openTeamModal();
    }
    if (action === 'logout') {
      closeModal(true);
      onLogout();
    }
    if (event.target.closest('#account-save-name')) {
      const name = $('#account-name', modal).value.trim();
      if (name.length < 2) {
        toast('Name must be at least 2 characters', 'error');
        return;
      }
      try {
        await patchMe({ name });
        renderAll();
        toast('Name updated', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });
  updateThemeIcon();
  setTimeout(() => $('#account-name', modal)?.focus(), 50);
}

/* ── Team & access ────────────────────────────────────────────────────────── */

function teamUserRow(user) {
  return `
    <div class="team-row ${user.active ? '' : 'inactive'}" data-team-user="${user.id}">
      <span class="avatar sm" style="--h:${hueOf(user.name)}">${esc(initials(user.name))}</span>
      <div class="team-main">
        <strong>${esc(user.name)}${user.id === state.user.id ? ' · you' : ''}</strong>
        <span>@${esc(user.username)}${user.mustChangePassword ? ' · temp password' : ''}</span>
      </div>
      <span class="role-badge role-${esc(user.role.toLowerCase())}">${esc(user.role)}</span>
      <span class="status-dot ${user.active ? 'on' : ''}" title="${user.active ? 'Active' : 'Deactivated'}"></span>
      <button class="btn ghost sm" data-edit-user="${user.id}">Edit</button>
    </div>`;
}

async function loadTeamList(modal) {
  const list = $('#team-list', modal);
  if (!list) return;
  try {
    const { users } = await api('/users');
    state.teamUsers = users;
    list.innerHTML = users.map(teamUserRow).join('');
  } catch (err) {
    list.innerHTML = `<p class="empty-note">${esc(err.message)}</p>`;
  }
}

async function openTeamModal() {
  if (!canManage()) return;
  const owner = state.user.role === 'Owner';
  const modal = openModal(
    `
    <div class="modal-head">
      <div><h3>Team &amp; access</h3><p class="modal-sub">Everyone in a shared workspace can see all boards. New accounts start with a temporary password.</p></div>
      <button class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <form class="team-create" id="team-create">
        <div class="team-create-grid">
          <input class="input" id="team-name" placeholder="Full name" maxlength="80" required>
          <input class="input" id="team-username" placeholder="username" maxlength="60" autocapitalize="none" spellcheck="false" required>
          <input class="input" id="team-password" type="text" placeholder="Temp password (8+ chars)" minlength="8" required>
          <select class="select" id="team-role" aria-label="Role">
            <option value="Member">Member</option>
            <option value="Admin">Admin</option>
            ${owner ? '<option value="Owner">Owner</option>' : ''}
          </select>
          <button class="btn primary" type="submit">${icon('plus')}Add person</button>
        </div>
      </form>
      <div class="team-list" id="team-list"><p class="empty-note">Loading team…</p></div>
    </div>
    <div class="modal-foot">
      <span class="modal-sub">Owners can grant Owner. Admins manage Members and Admins.</span>
      <button class="btn ghost" data-act="close">Done</button>
    </div>
    `,
    { className: 'lg' },
  );

  await loadTeamList(modal);

  $('#team-create', modal)?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = $('button[type="submit"]', event.target);
    btn.disabled = true;
    try {
      await api('/users', {
        method: 'POST',
        body: {
          name: $('#team-name', modal).value.trim(),
          username: $('#team-username', modal).value.trim().toLowerCase(),
          password: $('#team-password', modal).value,
          role: $('#team-role', modal).value,
        },
      });
      event.target.reset();
      await loadTeamList(modal);
      await loadMeta();
      renderFilterbar();
      toast('Teammate added', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  $('#team-list', modal)?.addEventListener('click', (event) => {
    const id = Number(event.target.closest('[data-edit-user]')?.dataset.editUser);
    if (!id) return;
    const user = state.teamUsers?.find((item) => item.id === id);
    if (user) openUserEditModal(user);
  });

  modal.dataset.teamModal = '1';
}

async function openUserEditModal(user) {
  const owner = state.user.role === 'Owner';
  const self = user.id === state.user.id;
  const modal = openModal(
    `
    <div class="modal-head">
      <div><h3>Edit ${esc(user.name)}</h3><p class="modal-sub">@${esc(user.username)} · joined ${esc(
        formatDateTime(user.createdAt) || 'recently',
      )}</p></div>
      <button class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label for="edit-user-name">Display name</label>
        <input class="input" id="edit-user-name" maxlength="80" value="${esc(user.name)}">
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="edit-user-role">Role</label>
          <select class="select" id="edit-user-role" ${self ? 'disabled' : ''}>
            <option value="Member" ${user.role === 'Member' ? 'selected' : ''}>Member</option>
            <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
            ${owner ? `<option value="Owner" ${user.role === 'Owner' ? 'selected' : ''}>Owner</option>` : ''}
          </select>
        </div>
        <div class="field">
          <label for="edit-user-password">Reset password</label>
          <input class="input" id="edit-user-password" type="text" placeholder="Leave empty to keep" minlength="8">
        </div>
      </div>
      <label class="check-row">
        <input type="checkbox" id="edit-user-active" ${user.active ? 'checked' : ''} ${self ? 'disabled' : ''}>
        Account is active
      </label>
      <p class="check-note">Deactivating signs the person out immediately. Their cards and comments are kept.</p>
    </div>
    <div class="modal-foot">
      <div class="modal-foot-left">
        ${
          self
            ? ''
            : `<button class="btn ghost danger-text" data-act="delete-user">${icon('trash')}Remove</button>`
        }
      </div>
      <div class="modal-foot-right">
        <button class="btn ghost" data-act="close">Cancel</button>
        <button class="btn primary" data-act="save-user">Save changes</button>
      </div>
    </div>
    `,
    { className: 'sm' },
  );

  modal.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action === 'save-user') {
      const body = { name: $('#edit-user-name', modal).value.trim() };
      const password = $('#edit-user-password', modal).value;
      if (!self) {
        body.role = $('#edit-user-role', modal).value;
        body.active = $('#edit-user-active', modal).checked;
      }
      if (password) body.password = password;
      try {
        await api(`/users/${user.id}`, { method: 'PATCH', body });
        closeModal(true);
        toast('User updated', 'success');
        openTeamModal();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    if (action === 'delete-user') {
      const ok = await confirmDialog({
        title: 'Remove teammate?',
        message: `<strong>${esc(user.name)}</strong> will lose access immediately. Their cards stay on the board.`,
        confirmLabel: 'Remove teammate',
      });
      if (!ok) return;
      try {
        await api(`/users/${user.id}`, { method: 'DELETE' });
        closeModal(true);
        toast('Teammate removed', 'success');
        openTeamModal();
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });
}

/* ── Comments ─────────────────────────────────────────────────────────────── */

function commentHtml(comment) {
  const own = comment.userId === state.user?.id;
  const canDelete = own || canManage();
  return `
    <div class="comment" data-comment-id="${comment.id}">
      <span class="avatar sm" style="--h:${hueOf(comment.authorName)}">${esc(
        initials(comment.authorName),
      )}</span>
      <div class="comment-main">
        <div class="comment-head">
          <strong>${esc(comment.authorName)}${own ? ' · you' : ''}</strong>
          <time datetime="${esc(comment.createdAt)}">${esc(formatDateTime(comment.createdAt))}</time>
          ${
            canDelete
              ? `<button class="icon-btn comment-delete" data-comment-delete="${comment.id}" title="Delete comment" aria-label="Delete comment">${icon('trash')}</button>`
              : ''
          }
        </div>
        <p>${esc(comment.body)}</p>
      </div>
    </div>`;
}

async function loadComments(cardId, modal) {
  const list = $('#comment-list', modal);
  if (!list) return;
  try {
    const { comments } = await api(`/cards/${cardId}/comments`);
    list.innerHTML = comments.length
      ? comments.map(commentHtml).join('')
      : '<p class="comment-empty">No comments yet — start the conversation.</p>';
    const count = $('#comment-count', modal);
    if (count) count.textContent = String(comments.length);
    const card = state.cards.find((item) => item.id === cardId);
    if (card && card.commentCount !== comments.length) {
      card.commentCount = comments.length;
      renderBoard();
    }
  } catch (err) {
    list.innerHTML = `<p class="comment-empty">${esc(err.message)}</p>`;
  }
}

/* ── Activity timeline ────────────────────────────────────────────────────── */

const ACTIVITY_META = {
  created: { icon: 'plus', label: 'Created', tone: 'info' },
  updated: { icon: 'settings', label: 'Edited', tone: 'info' },
  priority: { icon: 'flag', label: 'Priority', tone: 'warn' },
  due: { icon: 'calendar', label: 'Due date', tone: 'info' },
  assigned: { icon: 'user', label: 'Assigned', tone: 'info' },
  moved: { icon: 'arrow', label: 'Moved', tone: 'info' },
  completed: { icon: 'check', label: 'Completed', tone: 'success' },
  reopened: { icon: 'restore', label: 'Reopened', tone: 'warn' },
  archived: { icon: 'archive', label: 'Archived', tone: 'muted' },
  restored: { icon: 'restore', label: 'Restored', tone: 'info' },
  deleted: { icon: 'trash', label: 'Deleted', tone: 'muted' },
  labels: { icon: 'tag', label: 'Labels', tone: 'info' },
  commented: { icon: 'comment', label: 'Commented', tone: 'info' },
};

function activityForCard(cardId) {
  if (!Array.isArray(state.activity)) return [];
  return state.activity.filter((event) => event.cardId === cardId);
}

function cardActivityCount(cardId) {
  return activityForCard(cardId).length;
}

function cardHistoryHtml(cardId) {
  const events = activityForCard(cardId).slice(0, 20);
  if (!events.length) {
    return '<li class="card-history-empty">No history yet — changes to this card will appear here.</li>';
  }
  return events
    .map((event) => {
      const meta = ACTIVITY_META[event.type] ?? { icon: 'info', label: 'Change', tone: 'info' };
      const detail = event.detail || `${meta.label}`;
      return `
        <li class="card-history-item tone-${meta.tone}">
          <span class="activity-dot" aria-hidden="true">${icon(meta.icon)}</span>
          <div class="activity-body">
            <div class="activity-row">
              <strong>${esc(event.userName || 'System')}</strong>
              <span>${esc(detail)}</span>
            </div>
            <time>${esc(formatDateTime(event.createdAt))}</time>
          </div>
        </li>`;
    })
    .join('');
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
              : `<div class="card-people-row">
                  <div class="person-line created">
                    <span class="avatar" style="--h:${hueOf(card.createdByName || 'Unknown')}">${esc(initials(card.createdByName || '?'))}</span>
                    <div>
                      <em>Created by</em>
                      <strong>${esc(card.createdByName || 'Unknown')}</strong>
                      <time>${esc(formatDateTime(card.createdAt))}</time>
                    </div>
                  </div>
                  <div class="person-line working ${card.assignee ? '' : 'muted'}">
                    <span class="avatar ${card.assignee ? '' : 'ghost'}" style="--h:${hueOf(card.assignee || 'Unassigned')}">${
                      card.assignee ? esc(initials(card.assignee)) : icon('user')
                    }</span>
                    <div>
                      <em>Working on it</em>
                      <strong>${esc(card.assignee || 'Unassigned')}</strong>
                      <time>Last updated ${esc(formatDateTime(card.updatedAt))}</time>
                    </div>
                  </div>
                </div>
                <div class="card-history" id="card-history">
                  <div class="card-history-head"><span>Activity</span><span class="card-history-count">${cardActivityCount(card.id)}</span></div>
                  <ol class="card-history-list">${cardHistoryHtml(card.id)}</ol>
                </div>
                <div class="comments" id="card-comments">
                  <div class="comments-head">
                    <span>Discussion</span>
                    <span class="comments-count" id="comment-count">${card.commentCount ?? 0}</span>
                  </div>
                  <div class="comment-list" id="comment-list"><p class="comment-empty">Loading discussion…</p></div>
                  <form class="comment-form" id="comment-form">
                    <textarea class="input comment-input" id="comment-body" rows="2" maxlength="4000"
                      placeholder="Write a comment…"></textarea>
                    <button class="btn primary sm" type="submit" id="comment-submit">${icon('send')}Post</button>
                  </form>
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
            <label for="card-assignee">Working on it</label>
            <input class="input" id="card-assignee" list="assignee-options" placeholder="Who's handling this?"
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
  state.openCardId = isNew ? null : card.id;
  if (!isNew) loadComments(card.id, modal);

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

    const commentDelete = event.target.closest('[data-comment-delete]');
    if (commentDelete && !isNew) {
      try {
        await api(`/comments/${commentDelete.dataset.commentDelete}`, { method: 'DELETE' });
        await loadComments(card.id, modal);
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });

  const commentForm = $('#comment-form', modal);
  commentForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('#comment-body', modal);
    const body = input.value.trim();
    if (!body) {
      input.focus();
      return;
    }
    const btn = $('#comment-submit', modal);
    btn.disabled = true;
    try {
      await api(`/cards/${card.id}/comments`, { method: 'POST', body: { body } });
      input.value = '';
      await loadComments(card.id, modal);
      input.focus();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
  commentForm?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commentForm.requestSubmit();
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

function accentChooserHtml(current) {
  const normalized = (current ?? DEFAULT_ACCENT).toLowerCase();
  const swatches = ACCENT_PRESETS.map(
    (preset) => `
      <button type="button" class="accent-swatch ${
        preset.value.toLowerCase() === normalized ? 'on' : ''
      }" data-accent-preset="${esc(preset.value)}" style="--c:${esc(preset.value)}"
        title="${esc(preset.name)}" aria-label="${esc(preset.name)}"></button>`,
  ).join('');
  return `
    <div class="field accent-field">
      <label for="board-accent">Accent</label>
      <div class="accent-row">
        <input type="color" id="board-accent" value="${esc(normalized)}">
        <div class="accent-presets" role="group" aria-label="Accent presets">${swatches}</div>
      </div>
      <p class="accent-hint">Each board keeps its own accent — the whole page smoothly re-paints when you switch boards.</p>
    </div>`;
}

function wireAccentPreview(modal, { previous }) {
  const input = $('#board-accent', modal);
  if (!input) return () => {};
  const presets = $$('.accent-swatch', modal);
  const update = (value, { fromPreset = false } = {}) => {
    input.value = value;
    presets.forEach((btn) => btn.classList.toggle('on', btn.dataset.accentPreset?.toLowerCase() === value.toLowerCase()));
    applyAccent(value);
    if (!fromPreset) {
      // user picked a custom color — clear any "on" preset not matching
    }
  };
  input.addEventListener('input', (event) => update(event.target.value));
  modal.addEventListener('click', (event) => {
    const preset = event.target.closest('[data-accent-preset]');
    if (!preset) return;
    event.preventDefault();
    update(preset.dataset.accentPreset, { fromPreset: true });
  });
  let committed = false;
  const commit = () => {
    committed = true;
  };
  const revert = () => {
    if (!committed) applyAccent(previous);
  };
  return { commit, revert };
}

function openNewBoardModal() {
  const previousAccent = state.board?.accent ?? state.accent ?? DEFAULT_ACCENT;
  const initial = ACCENT_PRESETS[Math.floor(Math.random() * ACCENT_PRESETS.length)].value;
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
      ${accentChooserHtml(initial)}
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

  const preview = wireAccentPreview(modal, { previous: previousAccent });
  modal._onClose = () => preview.revert();
  applyAccent(initial);

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
      preview.commit();
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
  const previousAccent = state.board.accent;
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
      ${accentChooserHtml(state.board.accent)}
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

  const preview = wireAccentPreview(modal, { previous: previousAccent });
  modal._onClose = () => preview.revert();

  modal.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action === 'cancel') closeModal();

    if (action === 'save') {
      const name = $('#board-name', modal).value.trim();
      if (!name) {
        toast('Board name is required', 'error');
        return;
      }
      const nextAccent = $('#board-accent', modal).value;
      try {
        await api(`/boards/${state.board.id}`, {
          method: 'PATCH',
          body: {
            name,
            description: $('#board-desc', modal).value.trim(),
            accent: nextAccent,
          },
        });
        preview.commit();
        state.board.accent = nextAccent;
        applyAccent(nextAccent);
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
        preview.commit();
        closeModal();
        state.board = null;
        state.columns = [];
        state.cards = [];
        state.activity = [];
        await loadBoards();
        if (state.boards[0]) await loadBoard(state.boards[0].id);
        else {
          applyAccent(null);
          renderAll();
        }
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
  if (state.pendingRefresh && state.board) {
    state.pendingRefresh = false;
    loadBoard(state.board.id).catch(() => {});
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

/* ── Sidebar collapse (desktop) ───────────────────────────────────────────── */

function sidebarCollapseStored() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function setSidebarCollapsed(collapsed, { persist = true } = {}) {
  const desktop = window.innerWidth > 980;
  const active = desktop && collapsed;
  ui.app.classList.toggle('sidebar-collapsed', active);
  ui.sidebar.inert = active;
  if (active) ui.sidebar.setAttribute('aria-hidden', 'true');
  else ui.sidebar.removeAttribute('aria-hidden');

  const label = active ? 'Show sidebar' : 'Hide sidebar';
  ui.btnCollapse.setAttribute('aria-expanded', String(!active));
  ui.btnCollapse.setAttribute('aria-label', label);
  ui.btnCollapse.title = `${label} ([)`;

  if (persist && desktop) {
    try {
      localStorage.setItem(SIDEBAR_KEY, active ? 'collapsed' : 'open');
    } catch {
      /* ignore */
    }
  }
}

function applySidebarCollapse() {
  setSidebarCollapsed(sidebarCollapseStored(), { persist: false });
}

function toggleSidebarCollapsed() {
  if (window.innerWidth <= 980) return;
  setSidebarCollapsed(!ui.app.classList.contains('sidebar-collapsed'));
}

/* ── Init ─────────────────────────────────────────────────────────────────── */

function setView(view) {
  state.view = view === 'calendar' ? 'calendar' : 'board';
  try {
    localStorage.setItem(VIEW_KEY, state.view);
  } catch {
    /* ignore */
  }
  renderAll();
}

function wireEvents() {
  // Login / logout
  ui.loginForm.addEventListener('submit', onLogin);
  ui.btnLogout.addEventListener('click', onLogout);

  // Sidebar
  ui.btnMenu.addEventListener('click', openSidebar);
  ui.btnSidebarClose.addEventListener('click', closeSidebar);
  ui.btnCollapse.addEventListener('click', toggleSidebarCollapsed);
  ui.scrim.addEventListener('click', closeSidebar);
  ui.btnNewBoard.addEventListener('click', openNewBoardModal);
  ui.btnManageLabels.addEventListener('click', () => openLabelManager());
  ui.btnTeamSide?.addEventListener('click', openTeamModal);
  ui.userChip.addEventListener('click', openAccountModal);

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
  ui.btnTheme?.addEventListener('click', toggleTheme);
  ui.btnHelp?.addEventListener('click', () => {
    if (state.tour.active) endTour(false);
    else startTour();
  });
  ui.btnTeam?.addEventListener('click', openTeamModal);
  ui.presence?.addEventListener('click', openOnlineModal);

  // Board / calendar switch
  ui.viewToggle?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-view]');
    if (!btn) return;
    setView(btn.dataset.view);
  });

  ui.calendar?.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-cal]');
    if (nav) {
      const action = nav.dataset.cal;
      if (action === 'prev') state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1);
      if (action === 'next') state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1);
      if (action === 'today') {
        const now = new Date();
        state.calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      renderCalendar();
      renderFilterbar();
      return;
    }
    const card = event.target.closest('[data-cal-card]');
    if (card) {
      event.stopPropagation();
      openCardModal(Number(card.dataset.calCard));
      return;
    }
    const dayCell = event.target.closest('[data-cal-day]');
    if (dayCell && dayCell.classList.contains('has-events')) {
      openDayDetail(dayCell.dataset.calDay);
      return;
    }
    if (event.target.closest('#empty-create-board')) openNewBoardModal();
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

  // Smooth horizontal panning: Shift + wheel, trackpad swipe, or arrow keys
  ui.board.addEventListener('wheel', onBoardWheel, { passive: false });

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

    if (event.key === '[' && window.innerWidth > 980) {
      event.preventDefault();
      toggleSidebarCollapsed();
      return;
    }

    if (handleBoardPanKeys(event)) return;

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

  // Keep the desktop collapse and mobile drawer from fighting each other
  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) closeSidebar();
    applySidebarCollapse();
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
    'app', 'sidebar', 'scrim', 'board-list', 'side-labels', 'side-team-block', 'user-chip', 'btn-logout',
    'btn-new-board', 'btn-manage-labels', 'btn-menu', 'btn-sidebar-close', 'btn-collapse', 'btn-team-side',
    'board-head', 'topbar-actions', 'btn-board-settings', 'btn-new-card',
    'btn-theme', 'theme-icon', 'btn-help', 'btn-team', 'presence',
    'filterbar', 'filter-q', 'btn-label-filter', 'label-filter-count', 'label-popover',
    'filter-assignee', 'filter-priority', 'btn-archived', 'archived-count',
    'btn-clear-filters', 'view-hint', 'view-toggle', 'board', 'calendar',
    'modal-root', 'toasts', 'tour-root',
  ];
  for (const id of ids) {
    const key = id.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    ui[key] = document.getElementById(id);
  }

  updateThemeIcon();
  applySidebarCollapse();
  wireEvents();
  boot().catch(() => showLogin());
}

async function boot() {
  try {
    const { user } = await api('/auth/me');
    state.user = user;
    showAppShell();
    await enterApp();
  } catch {
    showLogin();
  }
}

init();
