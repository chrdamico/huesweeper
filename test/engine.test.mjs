import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepare } from '../public/js/board.js';
import { buildModel, solve } from '../public/js/solver.js';
import { generatePuzzle, verifyPuzzle } from '../public/js/generator.js';
import { mulberry32, randInt } from '../public/js/rng.js';

function allSolutions(prep, kind, limit = 1e9) {
  const { N, C, nbs, nums, sol, partner } = prep;
  const val = new Int8Array(N).fill(-1);
  const vars = [];
  for (let i = 0; i < N; i++) {
    if (kind[i] === 'g' || kind[i] === 'p') val[i] = sol[i];
    else vars.push(i);
  }
  const cons = [];
  for (let i = 0; i < N; i++) if (kind[i] === 'g' || kind[i] === 'm') cons.push(i);
  const pos = new Int32Array(N).fill(-1);
  vars.forEach((v, t) => (pos[v] = t));
  const checksAt = vars.map(() => []);
  for (const i of cons) {
    let last = pos[i];
    for (const j of nbs[i]) last = Math.max(last, pos[j]);
    if (last >= 0) checksAt[last].push(['c', i]);
  }
  for (let i = 0; i < N; i++) {
    const p = partner[i];
    if (p > i) {
      const last = Math.max(pos[i], pos[p]);
      if (last >= 0) checksAt[last].push(['s', i, p]);
    }
  }
  const ok = (chk) => {
    if (chk[0] === 's') return val[chk[1]] === val[chk[2]];
    const i = chk[1];
    let n = 0;
    for (const j of nbs[i]) if (val[j] === val[i]) n++;
    return n === nums[i];
  };
  for (const i of cons) {
    if (pos[i] >= 0) continue;
    if (nbs[i].every((j) => pos[j] < 0) && !ok(['c', i])) return Object.assign([], { count: 0, union: new Uint8Array(N) });
  }
  const out = [];
  out.count = 0;
  out.union = new Uint8Array(N);
  const rec = (t) => {
    if (out.count >= limit) return;
    if (t === vars.length) {
      out.count++;
      for (let i = 0; i < N; i++) out.union[i] |= 1 << val[i];
      if (out.length < 4) out.push(Array.from(val));
      return;
    }
    const v = vars[t];
    for (let c = 0; c < C; c++) {
      val[v] = c;
      if (checksAt[t].every(ok)) rec(t + 1);
    }
    val[v] = -1;
  };
  rec(0);
  return out;
}

const RULESETS = [
  { c: 2 },
  { c: 3 },
  { c: 4 },
  { c: 2, sym: 'mirror' },
  { c: 2, sym: 'rot' },
  { c: 2, silent: true },
  { c: 2, mystery: true },
  { c: 3, mystery: true },
  { c: 2, nb: 'cross' },
  { c: 2, nb: 'knight' },
  { c: 2, wrap: true, w: 5, h: 5 },
  { c: 3, nb: 'knight', wrap: true, w: 5, h: 5 },
];

test('generated puzzles have exactly one solution, found by the solver', () => {
  for (const rs of RULESETS) {
    for (let s = 1; s <= 6; s++) {
      const p = generatePuzzle({ w: rs.w || 4, h: rs.h || 5, diff: 3, seed: s * 7919, ...rs });
      const prep = prepare(p);
      const sols = allSolutions(prep, p.kind, 2);
      assert.equal(sols.count, 1, `unique: ${JSON.stringify(rs)} seed ${s}`);
      assert.deepEqual(sols[0], Array.from(prep.sol));
      assert.ok(verifyPuzzle(p));
    }
  }
});

test('solver never removes a colour that appears in some solution', () => {
  const rng = mulberry32(12345);
  let checked = 0;
  for (let iter = 0; iter < 3000; iter++) {
    const rs = RULESETS[iter % RULESETS.length];
    const small = rs.c > 2 ? 3 : 3 + randInt(rng, 2);
    const w = rs.w || small;
    const h = rs.h || small;
    const c = rs.c;
    const N = w * h;
    let sol = '';
    for (let i = 0; i < N; i++) sol += randInt(rng, c);
    const p = { w, h, c, nb: rs.nb, wrap: rs.wrap, sym: rs.sym, sol };
    const prep = prepare(p);
    if (rs.sym) {
      const arr = Array.from(prep.sol);
      for (let i = 0; i < N; i++) if (prep.partner[i] > i) arr[prep.partner[i]] = arr[i];
      p.sol = arr.join('');
    }
    const prep2 = prepare(p);
    const kinds = rs.mystery ? '..gm' : rs.silent ? '..gp' : '..g';
    let kind = '';
    for (let i = 0; i < N; i++) kind += kinds[randInt(rng, kinds.length)];
    const k = kind.split('');
    const budget = Math.floor(14 / Math.log2(c));
    let vars = k.filter((x) => x === '.' || x === 'm').length;
    while (vars > budget) {
      const i = randInt(rng, N);
      if (k[i] === '.' || k[i] === 'm') {
        k[i] = 'g';
        vars--;
      }
    }
    kind = k.join('');
    const sols = allSolutions(prep2, kind);
    const res = solve(buildModel(prep2, kind), { maxLevel: 3 });
    assert.ok(res.ok, 'true solution exists so no contradiction');
    for (let i = 0; i < N; i++) assert.equal(res.dom[i] & sols.union[i], sols.union[i], `iter ${iter} cell ${i}`);
    if (res.solved) assert.equal(sols.count, 1);
    checked += sols.count;
  }
  assert.ok(checked > 400);
});

test('solver levels are monotone', () => {
  for (let s = 1; s <= 20; s++) {
    const p = generatePuzzle({ w: 7, h: 7, c: 2, diff: 3, seed: s });
    const prep = prepare(p);
    const m = buildModel(prep, p.kind);
    const r1 = solve(m, { maxLevel: 1 });
    const r2 = solve(m, { maxLevel: 2 });
    const r3 = solve(m, { maxLevel: 3 });
    assert.ok(r3.solved);
    assert.equal(r3.level, p.level);
    if (r1.solved) assert.equal(p.level, 1);
    if (!r2.solved) assert.equal(p.level, 3);
  }
});

test('trace records a fixing step for every deduced cell', () => {
  const p = generatePuzzle({ w: 8, h: 8, c: 3, diff: 3, seed: 99, mystery: true });
  const prep = prepare(p);
  const m = buildModel(prep, p.kind);
  const trace = [];
  const res = solve(m, { maxLevel: 3, trace });
  assert.ok(res.solved);
  const fixed = new Set(trace.flatMap((s) => s.fixed));
  for (let i = 0; i < prep.N; i++) {
    if (p.kind[i] === '.' || p.kind[i] === 'm') assert.ok(fixed.has(i), `cell ${i} fixed by a step`);
  }
});
