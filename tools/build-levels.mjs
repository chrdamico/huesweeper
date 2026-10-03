import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WORLDS, levelId } from '../public/js/campaign.js';
import { PICTURES, pictureSolution } from '../public/js/pictures.js';
import { generatePuzzle, verifyPuzzle } from '../public/js/generator.js';
import { hashString } from '../public/js/rng.js';

const KEEP = ['w', 'h', 'c', 'nb', 'wrap', 'sym', 'shapes', 'inv', 'tally', 'sol', 'kind', 'tl', 'level'];
const pick = (p, extra) => Object.assign(Object.fromEntries(KEEP.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])), extra);

function describe(p) {
  const n = { '.': 0, g: 0, p: 0, m: 0 };
  for (const k of p.kind) n[k]++;
  return `${p.w}x${p.h} c${p.c} lvl${p.level} blank ${n['.']}/${p.w * p.h} p${n.p} m${n.m}`;
}

const t0 = Date.now();
const campaign = WORLDS.map((W) =>
  W.levels.map((lv, li) => {
    const id = levelId(W.key, li);
    const p = generatePuzzle({ c: 2, ...W.rules, ...lv, seed: hashString(id), attempts: 24 });
    if (!verifyPuzzle(p)) throw new Error(`bad ${id}`);
    console.log(id.padEnd(6), `diff${lv.diff}`, describe(p));
    return pick(p, { id });
  }),
);

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
  console.log(pic.id.padEnd(9), describe(p));
  return pick(p, { id: `g-${pic.id}`, title: pic.title, palette: pic.palette });
});

const out = fileURLToPath(new URL('../public/js/levels-data.js', import.meta.url));
writeFileSync(out, `export const CAMPAIGN = ${JSON.stringify(campaign)};\nexport const GALLERY = ${JSON.stringify(gallery)};\n`);
console.log('wrote', out, `${campaign.flat().length} levels, ${gallery.length} pictures, ${Date.now() - t0}ms`);
