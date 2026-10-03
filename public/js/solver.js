export function single(d) {
  return d !== 0 && (d & (d - 1)) === 0;
}

export function bitIndex(d) {
  return 31 - Math.clz32(d);
}

export function buildModel(prep, kind, tl = null) {
  const { N, C, nbs, same, sol, partner, w, h, tally } = prep;
  const FULL = (1 << C) - 1;
  const cSrc = [];
  const cCol = [];
  const cTal = [];
  const cN = [];
  const cCells = [];
  const conOfSrc = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    const k = kind[i];
    if (k === 'g' || k === 'm') {
      conOfSrc[i] = cSrc.length;
      cSrc.push(i);
      cCol.push(-1);
      cTal.push(null);
      cN.push(same[i]);
      cCells.push(nbs[i]);
    }
  }
  if (tally) {
    const line = (id, n, cells) => {
      cSrc.push(-1);
      cCol.push(0);
      cTal.push(id);
      cN.push(n);
      cCells.push(Int32Array.from(cells));
    };
    for (let r = 0; r < h; r++) {
      if (tl && tl[r] !== '1') continue;
      line(`r${r}`, tally.rows[r], Array.from({ length: w }, (_, x) => r * w + x));
    }
    for (let c = 0; c < w; c++) {
      if (tl && tl[h + c] !== '1') continue;
      line(`c${c}`, tally.cols[c], Array.from({ length: h }, (_, y) => y * w + c));
    }
  }
  const M = cSrc.length;
  const memberOf = Array.from({ length: N }, () => []);
  for (let c = 0; c < M; c++) for (const j of cCells[c]) memberOf[j].push(c);
  const cellCons = new Array(N);
  for (let i = 0; i < N; i++) {
    const list = memberOf[i].slice();
    if (conOfSrc[i] >= 0) list.push(conOfSrc[i]);
    cellCons[i] = Int32Array.from(list);
  }
  const seen = new Set();
  const pa = [];
  const pb = [];
  for (let i = 0; i < N; i++) {
    const l = memberOf[i];
    for (let x = 0; x < l.length; x++) {
      for (let y = x + 1; y < l.length; y++) {
        const a = Math.min(l[x], l[y]);
        const b = Math.max(l[x], l[y]);
        const key = a * M + b;
        if (seen.has(key)) continue;
        seen.add(key);
        pa.push(a);
        pb.push(b);
      }
    }
  }
  const dom0 = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const k = kind[i];
    dom0[i] = k === 'g' || k === 'p' ? 1 << sol[i] : FULL;
  }
  return {
    prep,
    kind,
    N,
    C,
    FULL,
    M,
    cSrc: Int32Array.from(cSrc),
    cCol: Int32Array.from(cCol),
    cTal,
    cN: Int32Array.from(cN),
    cCells,
    conOfSrc,
    cellCons,
    pairsA: Int32Array.from(pa),
    pairsB: Int32Array.from(pb),
    partner,
    dom0,
    ctx: null,
  };
}

class Ctx {
  constructor(m) {
    this.m = m;
    this.q = new Int32Array(m.M + 1);
    this.qh = 0;
    this.qt = 0;
    this.qn = 0;
    this.inQ = new Uint8Array(m.M);
    this.mark = new Int32Array(m.N);
    this.stamp = 0;
    this.ua = new Int32Array(16);
    this.ub = new Int32Array(16);
    this.li = new Int32Array(16);
    this.la = new Int32Array(16);
    this.lb = new Int32Array(16);
    this.dom = null;
    this.trace = null;
    this.step = null;
  }

  push(c) {
    if (this.inQ[c]) return;
    this.inQ[c] = 1;
    this.q[this.qt] = c;
    this.qt = (this.qt + 1) % this.q.length;
    this.qn++;
  }

  pop() {
    const c = this.q[this.qh];
    this.qh = (this.qh + 1) % this.q.length;
    this.qn--;
    this.inQ[c] = 0;
    return c;
  }

  clearQ() {
    while (this.qn) this.pop();
  }

  begin(t, props) {
    if (this.trace) this.step = Object.assign({ t, cells: [], fixed: [] }, props);
  }

  end() {
    if (this.step) {
      if (this.step.cells.length) this.trace.push(this.step);
      this.step = null;
    }
  }

  set(j, nd) {
    const dom = this.dom;
    const old = dom[j];
    if (old === nd) return true;
    if (nd === 0) return false;
    dom[j] = nd;
    const cs = this.m.cellCons[j];
    for (let t = 0; t < cs.length; t++) this.push(cs[t]);
    if (this.step) {
      this.step.cells.push(j);
      if (single(nd)) this.step.fixed.push(j);
    }
    const p = this.m.partner[j];
    if (p >= 0 && dom[p] !== nd) {
      const pd = dom[p] & nd;
      if (pd !== nd && !this.set(j, pd)) return false;
      if (!this.set(p, pd)) return false;
    }
    return true;
  }
}

function propagate(ctx) {
  const m = ctx.m;
  const dom = ctx.dom;
  while (ctx.qn) {
    const c = ctx.pop();
    const src = m.cSrc[c];
    const n = m.cN[c];
    const cells = m.cCells[c];
    const ds = src >= 0 ? dom[src] : 1 << m.cCol[c];
    if (single(ds)) {
      let fixed = 0;
      let maybe = 0;
      for (let t = 0; t < cells.length; t++) {
        const d = dom[cells[t]];
        if (d === ds) fixed++;
        else if (d & ds) maybe++;
      }
      if (fixed > n || fixed + maybe < n) {
        ctx.clearQ();
        return false;
      }
      if (maybe === 0) continue;
      let mode = 0;
      if (fixed === n) mode = 1;
      else if (fixed + maybe === n) mode = 2;
      if (!mode) continue;
      ctx.begin(mode === 1 ? 'clear' : 'fill', { c, src, tal: m.cTal[c], k: bitIndex(ds) });
      for (let t = 0; t < cells.length; t++) {
        const j = cells[t];
        const d = dom[j];
        if (d === ds || !(d & ds)) continue;
        if (!ctx.set(j, mode === 1 ? d & ~ds : ds)) {
          ctx.step = null;
          ctx.clearQ();
          return false;
        }
      }
      ctx.end();
    } else {
      let nd = ds;
      for (let b = 1; b <= m.FULL; b <<= 1) {
        if (!(ds & b)) continue;
        let fixed = 0;
        let maybe = 0;
        for (let t = 0; t < cells.length; t++) {
          const d = dom[cells[t]];
          if (d === b) fixed++;
          else if (d & b) maybe++;
        }
        if (fixed > n || fixed + maybe < n) nd &= ~b;
      }
      if (nd !== ds) {
        ctx.begin('mask', { c, src, removed: ds & ~nd });
        if (!ctx.set(src, nd)) {
          ctx.step = null;
          ctx.clearQ();
          return false;
        }
        ctx.end();
      }
    }
  }
  return true;
}

function collect(ctx, c, s, K, out) {
  const m = ctx.m;
  const dom = ctx.dom;
  const cells = m.cCells[c];
  let fixed = 0;
  let len = 0;
  if (m.C === 2) {
    for (let t = 0; t < cells.length; t++) {
      const d = dom[cells[t]];
      if (d === s) fixed++;
      else if (d === m.FULL) out[len++] = cells[t];
    }
    const r = m.cN[c] - fixed;
    return [s === K ? r : len - r, len];
  }
  for (let t = 0; t < cells.length; t++) {
    const d = dom[cells[t]];
    if (d === K) fixed++;
    else if (d & K) out[len++] = cells[t];
  }
  return [m.cN[c] - fixed, len];
}

function applyGroup(ctx, list, len, K, fill) {
  const m = ctx.m;
  const dom = ctx.dom;
  for (let t = 0; t < len; t++) {
    const j = list[t];
    const nd = fill ? K : dom[j] & ~K;
    if (!ctx.set(j, nd)) return false;
  }
  return true;
}

function pairPass(ctx) {
  const m = ctx.m;
  const dom = ctx.dom;
  const mark = ctx.mark;
  for (let p = 0; p < m.pairsA.length; p++) {
    const a = m.pairsA[p];
    const b = m.pairsB[p];
    const sa = m.cSrc[a] >= 0 ? dom[m.cSrc[a]] : 1 << m.cCol[a];
    const sb = m.cSrc[b] >= 0 ? dom[m.cSrc[b]] : 1 << m.cCol[b];
    if (!single(sa) || !single(sb)) continue;
    let K;
    if (m.C === 2) K = 1;
    else if (sa !== sb) continue;
    else K = sa;
    const [ra, na] = collect(ctx, a, sa, K, ctx.ua);
    if (na === 0) continue;
    const [rb, nb] = collect(ctx, b, sb, K, ctx.ub);
    if (nb === 0) continue;
    const st = ++ctx.stamp;
    for (let t = 0; t < na; t++) mark[ctx.ua[t]] = st;
    let nI = 0;
    let nB = 0;
    for (let t = 0; t < nb; t++) {
      const j = ctx.ub[t];
      if (mark[j] === st) ctx.li[nI++] = j;
      else ctx.lb[nB++] = j;
    }
    if (nI === 0) continue;
    const st2 = ++ctx.stamp;
    for (let t = 0; t < nI; t++) mark[ctx.li[t]] = st2;
    let nA = 0;
    for (let t = 0; t < na; t++) {
      const j = ctx.ua[t];
      if (mark[j] !== st2) ctx.la[nA++] = j;
    }
    const minI = Math.max(0, ra - nA, rb - nB);
    const maxI = Math.min(nI, ra, rb);
    if (minI > maxI) return false;
    let aMode = 0;
    let bMode = 0;
    if (nA > 0) {
      if (ra - maxI === nA) aMode = 2;
      else if (ra - minI === 0) aMode = 1;
    }
    if (nB > 0) {
      if (rb - maxI === nB) bMode = 2;
      else if (rb - minI === 0) bMode = 1;
    }
    if (!aMode && !bMode) continue;
    ctx.begin('pair', { a, b, srcA: m.cSrc[a], srcB: m.cSrc[b], talA: m.cTal[a], talB: m.cTal[b], k: bitIndex(K) });
    let ok = true;
    if (aMode) ok = applyGroup(ctx, ctx.la, nA, K, aMode === 2);
    if (ok && bMode) ok = applyGroup(ctx, ctx.lb, nB, K, bMode === 2);
    if (!ok) {
      ctx.step = null;
      return false;
    }
    ctx.end();
    return true;
  }
  return null;
}

function trialPass(ctx) {
  const m = ctx.m;
  const outer = ctx.dom;
  const trace = ctx.trace;
  ctx.trace = null;
  ctx.step = null;
  const start = ctx.trialStart || 0;
  for (let s = 0; s < m.N; s++) {
    const i = (start + s) % m.N;
    const d = outer[i];
    if (single(d)) continue;
    for (let b = 1; b <= m.FULL; b <<= 1) {
      if (!(d & b)) continue;
      ctx.dom = outer.slice();
      const ok = ctx.set(i, b) && propagate(ctx);
      ctx.clearQ();
      ctx.dom = outer;
      if (!ok) {
        ctx.trace = trace;
        ctx.trialStart = i;
        ctx.begin('trial', { cell: i, k: bitIndex(b) });
        const r = ctx.set(i, outer[i] & ~b);
        if (!r) ctx.step = null;
        ctx.end();
        return r;
      }
    }
  }
  ctx.trace = trace;
  return null;
}

function allSingle(dom) {
  for (let i = 0; i < dom.length; i++) if (!single(dom[i])) return false;
  return true;
}

export function solve(m, { maxLevel = 3, trace = null, dom = null } = {}) {
  if (!m.ctx) m.ctx = new Ctx(m);
  const ctx = m.ctx;
  const d = dom ? Uint8Array.from(dom) : m.dom0.slice();
  ctx.dom = d;
  ctx.trace = trace;
  ctx.step = null;
  ctx.trialStart = 0;
  let ok = true;
  let level = 1;
  for (let i = 0; i < m.N && ok; i++) {
    if (d[i] === 0) ok = false;
    const p = m.partner[i];
    if (ok && p >= 0 && d[p] !== d[i]) {
      const nd = d[i] & d[p];
      ctx.begin('sym', { from: d[i] === nd ? i : p });
      ok = nd !== 0 && ctx.set(i, nd) && ctx.set(p, nd);
      if (!ok) ctx.step = null;
      ctx.end();
    }
  }
  for (let c = 0; c < m.M; c++) ctx.push(c);
  while (ok) {
    if (!propagate(ctx)) {
      ok = false;
      break;
    }
    if (allSingle(d)) break;
    if (maxLevel >= 2) {
      const r = pairPass(ctx);
      if (r === false) {
        ok = false;
        break;
      }
      if (r) {
        if (level < 2) level = 2;
        continue;
      }
    }
    if (maxLevel >= 3) {
      const r = trialPass(ctx);
      if (r === false) {
        ok = false;
        break;
      }
      if (r) {
        level = 3;
        continue;
      }
    }
    break;
  }
  ctx.clearQ();
  ctx.trace = null;
  ctx.step = null;
  return { ok, solved: ok && allSingle(d), dom: d, level };
}
