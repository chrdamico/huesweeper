import { mulberry32, shuffle, randInt } from './rng.js';
import { prepare, symPartner } from './board.js';
import { buildModel, solve } from './solver.js';

export function randomSolution(w, h, c, sym, rng, clump = 0.3) {
  const N = w * h;
  const minCount = Math.max(2, Math.floor((0.55 * N) / c));
  for (let attempt = 0; ; attempt++) {
    const s = new Uint8Array(N);
    for (let i = 0; i < N; i++) s[i] = randInt(rng, c);
    const order = shuffle([...Array(N).keys()], rng);
    for (const i of order) {
      if (rng() >= clump) continue;
      const x = i % w;
      const y = (i / w) | 0;
      const opts = [];
      if (x > 0) opts.push(i - 1);
      if (x < w - 1) opts.push(i + 1);
      if (y > 0) opts.push(i - w);
      if (y < h - 1) opts.push(i + w);
      s[i] = s[opts[randInt(rng, opts.length)]];
    }
    if (sym) {
      for (let i = 0; i < N; i++) {
        const j = symPartner(i, w, h, sym);
        if (j > i) s[j] = s[i];
      }
    }
    const counts = new Array(c).fill(0);
    for (let i = 0; i < N; i++) counts[s[i]]++;
    if (counts.every((n) => n >= minCount) || attempt > 50) return s;
  }
}

function carve(prep, opts, rng) {
  const { N } = prep;
  const { diff, silent, mystery } = opts;
  const kind = new Array(N).fill('g');
  const ok = () => solve(buildModel(prep, kind), { maxLevel: diff }).solved;
  const order = shuffle([...Array(N).keys()], rng);
  const pm = opts.mysteryRate ?? 0.7;
  const ps = opts.silentRate ?? 0.7;
  for (const i of order) {
    if (silent && rng() < 0.2) {
      kind[i] = 'p';
      if (ok()) continue;
    }
    if (mystery && rng() < 0.12) {
      kind[i] = 'm';
      if (ok()) continue;
    }
    kind[i] = '.';
    if (ok()) continue;
    if (mystery && rng() < pm) {
      kind[i] = 'm';
      if (ok()) continue;
    }
    if (silent && rng() < ps) {
      kind[i] = 'p';
      if (ok()) continue;
    }
    kind[i] = 'g';
  }
  return kind;
}

function stats(kind) {
  const s = { blank: 0, g: 0, p: 0, m: 0 };
  for (const k of kind) {
    if (k === '.') s.blank++;
    else s[k]++;
  }
  return s;
}

export function generatePuzzle(opts) {
  const {
    w,
    h,
    c = 2,
    nb = 'king',
    wrap = false,
    sym = null,
    silent = false,
    mystery = false,
    diff = 2,
    seed = 1,
    sol = null,
    attempts = 4,
  } = opts;
  const rng = mulberry32(seed);
  let best = null;
  for (let a = 0; a < attempts; a++) {
    const solArr = sol ? Uint8Array.from(sol) : randomSolution(w, h, c, sym, rng, opts.clump ?? 0.3);
    const base = { w, h, c, nb, wrap, sym, sol: Array.from(solArr).join('') };
    const prep = prepare(base);
    const kind = carve(prep, { diff, silent, mystery, mysteryRate: opts.mysteryRate, silentRate: opts.silentRate }, rng);
    const res = solve(buildModel(prep, kind), { maxLevel: diff });
    if (!res.solved) continue;
    const st = stats(kind);
    const featureOk = (!silent || st.p > 0) && (!mystery || st.m > 0);
    const score = (res.level === diff ? 10000 : res.level * 1000) + (featureOk ? 5000 : 0) + st.blank * 10 + st.p + st.m;
    if (!best || score > best.score) best = { score, kind, base, level: res.level, st, featureOk };
    if (res.level === diff && featureOk) break;
  }
  const p = { ...best.base, kind: best.kind.join(''), diff, level: best.level, seed };
  if (!p.wrap) delete p.wrap;
  if (!p.sym) delete p.sym;
  if (p.nb === 'king') delete p.nb;
  return p;
}

export function verifyPuzzle(p) {
  const prep = prepare(p);
  const res = solve(buildModel(prep, p.kind), { maxLevel: 3 });
  if (!res.solved) return false;
  for (let i = 0; i < prep.N; i++) if (res.dom[i] !== 1 << prep.sol[i]) return false;
  return true;
}
