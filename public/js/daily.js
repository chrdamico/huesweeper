import { hashString } from './rng.js';

const SCHEDULE = [
  { name: 'Sunday Grand', w: 9, h: 9, c: 3, diff: 3, sym: 'mirror' },
  { name: 'Monday Classic', w: 7, h: 7, c: 2, diff: 2 },
  { name: 'Tuesday Mirror', w: 8, h: 8, c: 2, diff: 3, sym: 'mirror' },
  { name: 'Wednesday Trio', w: 7, h: 7, c: 3, diff: 3 },
  { name: 'Thursday Masks', w: 8, h: 8, c: 2, diff: 3, mystery: true },
  { name: 'Friday Knight', w: 7, h: 7, c: 2, diff: 3, nb: 'knight' },
  { name: 'Saturday Wild', w: 8, h: 8, c: 2, diff: 3, wrap: true, silent: true },
];

export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const SCHEDULE_B = [
  { name: 'Sunday Chimera', w: 8, h: 9, c: 2, diff: 3, nb: 'mixed', contrast: true, tally: true },
  { name: 'Monday Diagonals', w: 7, h: 7, c: 2, diff: 2, nb: 'diag' },
  { name: 'Tuesday Contrast', w: 8, h: 8, c: 2, diff: 3, contrast: true },
  { name: 'Wednesday Tallies', w: 8, h: 8, c: 2, diff: 3, tally: true },
  { name: 'Thursday Shapes', w: 8, h: 8, c: 2, diff: 3, nb: 'mixed' },
  { name: 'Friday Torus', w: 7, h: 7, c: 2, diff: 3, nb: 'knight', wrap: true },
  { name: 'Saturday Prism', w: 8, h: 8, c: 3, diff: 3, contrast: true, sym: 'mirror' },
];

export function dailyParams(key) {
  const date = keyToDate(key);
  const day = date.getDay();
  const week = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000 + 4) / 7);
  const { name, ...opts } = (week % 2 ? SCHEDULE_B : SCHEDULE)[day];
  return { name, opts: { ...opts, seed: hashString(`daily:${key}`), attempts: 8 } };
}

export function streak(history, today = dateKey()) {
  let n = 0;
  const d = keyToDate(today);
  if (!history[today]) d.setDate(d.getDate() - 1);
  while (history[dateKey(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function lastDays(count, today = dateKey()) {
  const out = [];
  const d = keyToDate(today);
  for (let i = 0; i < count; i++) {
    out.unshift(dateKey(d));
    d.setDate(d.getDate() - 1);
  }
  return out;
}
