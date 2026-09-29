const KEY = 'huesweeper:v1';

const DEFAULT_SETTINGS = {
  theme: 'auto',
  palette: 'candy',
  symbols: false,
  errors: true,
  cycle: false,
  sound: true,
  vibrate: true,
};

function fresh() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    done: {},
    saves: {},
    seen: {},
    endless: { opts: null, puzzle: null, solved: { 1: 0, 2: 0, 3: 0 } },
    daily: { history: {}, cache: null },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw);
    const base = fresh();
    return {
      ...base,
      ...d,
      settings: { ...base.settings, ...(d.settings || {}) },
      endless: { ...base.endless, ...(d.endless || {}) },
      daily: { ...base.daily, ...(d.daily || {}) },
    };
  } catch {
    return fresh();
  }
}

export const db = load();

let timer = 0;

export function persist(now = false) {
  clearTimeout(timer);
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {}
  };
  if (now) write();
  else timer = setTimeout(write, 250);
}

export function resetAll() {
  const keep = db.settings;
  const f = fresh();
  for (const k of Object.keys(db)) delete db[k];
  Object.assign(db, f, { settings: keep });
  persist(true);
}

window.addEventListener('pagehide', () => persist(true));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist(true);
});
