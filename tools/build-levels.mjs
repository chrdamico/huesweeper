import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WORLDS, levelId } from '../public/js/campaign.js';
import { PICTURES, pictureSolution } from '../public/js/pictures.js';
import { generatePuzzle, verifyPuzzle } from '../public/js/generator.js';
import { hashString } from '../public/js/rng.js';
import { effort } from './difficulty-report.mjs';

const KEEP = ['w', 'h', 'c', 'nb', 'wrap', 'sym', 'shapes', 'inv', 'tally', 'sol', 'kind', 'tl', 'level'];
const pick = (p, extra) => Object.assign(Object.fromEntries(KEEP.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])), extra);
const CANDIDATES = 8;

const isOriginal = (key, n) => key <= 10 && n < 8;

function make(W, lv, id, salt) {
  const seed = hashString(salt ? `${id}#${salt}` : id);
  const p = generatePuzzle({ c: 2, ...W.rules, ...lv, seed, attempts: 24 });
  if (!verifyPuzzle(p)) throw new Error(`bad ${id}`);
  return { p, e: effort(p) };
}

const t0 = Date.now();

const ref = [];
const original = new Map();
for (const W of WORLDS) {
  W.levels.forEach((lv, n) => {
    if (!isOriginal(W.key, n)) return;
    const r = make(W, lv, levelId(W.key, n), 0);
    original.set(levelId(W.key, n), r);
    ref.push({ diff: lv.diff, cells: lv.w * lv.h, e: r.e });
  });
}

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

function refTarget(lv) {
  const cells = lv.w * lv.h;
  let near = ref.filter((r) => r.diff === lv.diff && Math.abs(r.cells - cells) <= 13);
  if (!near.length) near = ref.filter((r) => r.diff === lv.diff);
  return median(near.map((r) => r.e));
}

function closest(W, lv, id, target, min = CANDIDATES, max = CANDIDATES * 3) {
  let best = null;
  for (let k = 0; k < max; k++) {
    const c = make(W, lv, id, k);
    const dist = Math.abs(Math.log((c.e + 5) / (target + 5)));
    if (!best || dist < best.dist) best = { ...c, dist };
    if (k + 1 >= min && best.dist < 0.2) break;
  }
  return best;
}

const report = [];
const campaign = WORLDS.map((W) => {
  const out = W.levels.map((lv, n) => {
    const id = levelId(W.key, n);
    if (isOriginal(W.key, n)) return { ...original.get(id), id, lv };
    if (lv.ch) return { id, lv };
    const target = W.key <= 9 && n >= 8 && n < 14 ? original.get(levelId(W.key, n - 7)).e : refTarget(lv);
    const best = closest(W, lv, id, target);
    if (best.dist > 0.35) report.push(`${id} target ${target} got ${best.e}`);
    return { ...best, id, lv, target };
  });
  const top = Math.max(...out.filter((o) => !o.lv.ch).map((o) => o.e));
  out.forEach((o, n) => {
    if (!o.lv.ch) return;
    const target = Math.round(top * (n === out.length - 1 ? 1.8 : 1.4));
    Object.assign(o, closest(W, o.lv, o.id, target, 4, 8), { target });
  });
  out.sort((a, b) => (a.lv.ch ? 1 : 0) - (b.lv.ch ? 1 : 0) || a.p.level - b.p.level || a.e - b.e);
  console.log(W.name.padEnd(16), out.map((o) => `${o.p.w}x${o.p.h}L${o.p.level}:${o.e}${o.lv.ch ? '!' : ''}`).join(' '));
  return out.map((o) => pick(o.p, { id: o.id, ...(o.lv.ch ? { ch: 1 } : {}) }));
});

const gallery = PICTURES.map((pic) => {
  const sol = pictureSolution(pic);
  const p = generatePuzzle({
    w: pic.rows[0].length,
    h: pic.rows.length,
    c: pic.key.length,
    sol,
    diff: pic.diff,
    seed: hashString(pic.id),
    attempts: 16,
  });
  if (!verifyPuzzle(p)) throw new Error(`bad ${pic.id}`);
  return pick(p, { id: `g-${pic.id}`, title: pic.title, palette: pic.palette });
});

const out = fileURLToPath(new URL('../public/js/levels-data.js', import.meta.url));
writeFileSync(out, `export const CAMPAIGN = ${JSON.stringify(campaign)};\nexport const GALLERY = ${JSON.stringify(gallery)};\n`);
if (report.length) console.log('far from target:', report.join('; '));
console.log('wrote', out, `${campaign.flat().length} levels, ${gallery.length} pictures, ${Date.now() - t0}ms`);
