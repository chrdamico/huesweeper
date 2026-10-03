const KEY = 'huesweeper:v1';
const BAK = 'huesweeper:v1:bak';

const DEFAULT_SETTINGS = {
  theme: 'auto',
  palette: 'candy',
  symbols: false,
  errors: true,
  cycle: false,
  sound: true,
  vibrate: true,
  unlockAll: false,
  _u: 0,
};

function fresh() {
  return {
    resetAt: 0,
    settings: { ...DEFAULT_SETTINGS },
    done: {},
    saves: {},
    seen: {},
    last: null,
    lastAt: 0,
    endless: { opts: null, optsAt: 0, mix: null, mixAt: 0, puzzle: null, puzzleAt: 0, solved: { 1: 0, 2: 0, 3: 0 }, solvedAt: 0 },
    daily: { history: {}, cache: null },
  };
}

export function normalize(d) {
  const base = fresh();
  if (!d || typeof d !== 'object') return base;
  return {
    ...base,
    ...d,
    settings: { ...base.settings, ...(d.settings || {}) },
    done: { ...(d.done || {}) },
    saves: { ...(d.saves || {}) },
    seen: { ...(d.seen || {}) },
    endless: { ...base.endless, ...(d.endless || {}), solved: { ...base.endless.solved, ...(d.endless?.solved || {}) } },
    daily: { ...base.daily, ...(d.daily || {}), history: { ...(d.daily?.history || {}) } },
  };
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

const stampOf = (x) => (x && typeof x === 'object' ? x.at ?? x.u ?? 1 : x || 1);

function best(a, b) {
  return { ...a, t: Math.min(a.t ?? Infinity, b.t ?? Infinity), h: Math.min(a.h ?? Infinity, b.h ?? Infinity), at: Math.max(a.at || 0, b.at || 0) || undefined };
}

export function mergeInto(t, s) {
  if (!s) return t;
  const resetAt = Math.max(t.resetAt || 0, s.resetAt || 0);
  if (resetAt > (t.resetAt || 0)) {
    for (const coll of [t.done, t.saves, t.seen, t.daily.history]) {
      for (const k of Object.keys(coll)) if (stampOf(coll[k]) < resetAt) delete coll[k];
    }
    if ((t.endless.solvedAt || 0) < resetAt) t.endless.solved = { 1: 0, 2: 0, 3: 0 };
    t.resetAt = resetAt;
  }
  const keep = (x) => stampOf(x) >= resetAt;
  for (const [k, v] of Object.entries(s.done)) {
    if (!keep(v)) continue;
    t.done[k] = t.done[k] ? best(t.done[k], v) : { ...v };
  }
  for (const [k, v] of Object.entries(s.daily.history)) {
    if (!keep(v)) continue;
    t.daily.history[k] = t.daily.history[k] ? best(t.daily.history[k], v) : { ...v };
  }
  for (const [k, v] of Object.entries(s.saves)) {
    if (!keep(v)) continue;
    const cur = t.saves[k];
    if (!cur || (v.u || 0) > (cur.u || 0)) t.saves[k] = v;
  }
  for (const [k, v] of Object.entries(s.seen)) if (keep(v) && !t.seen[k]) t.seen[k] = v;
  if (s.daily.cache && (!t.daily.cache || s.daily.cache.key > t.daily.cache.key)) t.daily.cache = s.daily.cache;
  if ((s.settings._u || 0) > (t.settings._u || 0)) Object.assign(t.settings, s.settings);
  if ((s.lastAt || 0) > (t.lastAt || 0)) {
    t.last = s.last;
    t.lastAt = s.lastAt;
  }
  for (const [f, at] of [['opts', 'optsAt'], ['mix', 'mixAt'], ['puzzle', 'puzzleAt']]) {
    if ((s.endless[at] || 0) > (t.endless[at] || 0)) {
      t.endless[f] = s.endless[f];
      t.endless[at] = s.endless[at];
    }
  }
  if ((s.endless.solvedAt || 0) >= resetAt) {
    for (const d of [1, 2, 3]) t.endless.solved[d] = Math.max(t.endless.solved[d] || 0, s.endless.solved[d] || 0);
    t.endless.solvedAt = Math.max(t.endless.solvedAt || 0, s.endless.solvedAt || 0);
  }
  return t;
}

function prune(d) {
  const keepEndless = d.endless.puzzle ? `endless-${d.endless.puzzle.seed}` : null;
  const today = new Date();
  today.setDate(today.getDate() - 14);
  const cutoff = `daily-${today.toISOString().slice(0, 10)}`;
  for (const coll of [d.saves, d.done]) {
    for (const k of Object.keys(coll)) {
      if (k.startsWith('endless-') && k !== keepEndless) delete coll[k];
      if (coll === d.saves && k.startsWith('daily-') && k < cutoff) delete coll[k];
    }
  }
}

export const db = read(KEY) || fresh();
mergeInto(db, read(BAK));

function signature(d) {
  return [Object.keys(d.done).length, Object.keys(d.daily.history).length, d.resetAt, d.settings._u, d.lastAt, d.endless.puzzleAt].join(':');
}

const listeners = new Set();

export function onExternalChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function absorb(sources) {
  const before = signature(db);
  for (const s of sources) mergeInto(db, s);
  if (signature(db) !== before) [...listeners].forEach((fn) => fn());
}

let timer = 0;

function write() {
  try {
    mergeInto(db, read(KEY));
    mergeInto(db, read(BAK));
    prune(db);
    const json = JSON.stringify(db);
    localStorage.setItem(KEY, json);
    localStorage.setItem(BAK, json);
  } catch {}
}

export function persist(now = false) {
  clearTimeout(timer);
  if (now) write();
  else timer = setTimeout(write, 250);
}

export function touchSettings() {
  db.settings._u = Date.now();
  persist();
}

export function resetAll() {
  const keep = { ...db.settings };
  const f = fresh();
  for (const k of Object.keys(db)) delete db[k];
  Object.assign(db, f, { settings: keep, resetAt: Date.now() });
  persist(true);
}

const CODE_PREFIX = 'HSW1:';

export function exportCode() {
  const data = {
    done: db.done,
    seen: db.seen,
    daily: { history: db.daily.history },
    endless: { solved: db.endless.solved, solvedAt: db.endless.solvedAt },
    settings: db.settings,
  };
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return CODE_PREFIX + btoa(bin);
}

export function importCode(code) {
  const raw = String(code).replace(/\s+/g, '');
  if (!raw.startsWith(CODE_PREFIX)) throw new Error('Not a Huesweeper backup code');
  const bin = atob(raw.slice(CODE_PREFIX.length));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  const data = normalize(JSON.parse(new TextDecoder().decode(bytes)));
  const now = Date.now();
  const lift = (coll) => {
    for (const v of Object.values(coll)) if (v && typeof v === 'object' && (v.at || 0) < db.resetAt) v.at = now;
  };
  lift(data.done);
  lift(data.daily.history);
  for (const k of Object.keys(data.seen)) if (stampOf(data.seen[k]) < db.resetAt) data.seen[k] = now;
  data.resetAt = 0;
  data.endless.solvedAt = Math.max(data.endless.solvedAt || 0, db.resetAt);
  const before = Object.keys(db.done).length;
  mergeInto(db, data);
  persist(true);
  return Object.keys(db.done).length - before;
}

if (typeof window !== 'undefined') window.addEventListener('storage', (e) => {
  if (e.key !== KEY && e.key !== BAK) return;
  try {
    absorb([e.newValue ? normalize(JSON.parse(e.newValue)) : null]);
  } catch {}
});

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => persist(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist(true);
    else absorb([read(KEY), read(BAK)]);
  });
}
