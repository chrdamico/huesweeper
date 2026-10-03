export const NEIGHBORHOODS = {
  king: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
  cross: [[0, -1], [-1, 0], [1, 0], [0, 1]],
  knight: [[1, -2], [2, -1], [2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2]],
  diag: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
};

export const SHAPE_OF_CODE = { k: 'king', c: 'cross', n: 'knight', d: 'diag' };
export const CODE_OF_SHAPE = { king: 'k', cross: 'c', knight: 'n', diag: 'd' };

export function shapeAt(p, i) {
  if (p.nb === 'mixed') return SHAPE_OF_CODE[p.shapes[i]] || 'king';
  return p.nb || 'king';
}

export function buildNeighbors(w, h, nb = 'king', wrap = false, shapes = null) {
  const out = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const offs = NEIGHBORHOODS[shapes ? SHAPE_OF_CODE[shapes[i]] || 'king' : nb];
      const set = new Set();
      for (const [dx, dy] of offs) {
        let nx = x + dx;
        let ny = y + dy;
        if (wrap) {
          nx = (nx + w) % w;
          ny = (ny + h) % h;
        } else if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
          continue;
        }
        const j = ny * w + nx;
        if (j !== i) set.add(j);
      }
      out[i] = Int32Array.from(set);
    }
  }
  return out;
}

export function symPartner(i, w, h, sym) {
  const x = i % w;
  const y = (i / w) | 0;
  if (sym === 'mirror') return y * w + (w - 1 - x);
  if (sym === 'rot') return (h - 1 - y) * w + (w - 1 - x);
  return i;
}

export function parseSol(sol) {
  const out = new Uint8Array(sol.length);
  for (let i = 0; i < sol.length; i++) out[i] = sol.charCodeAt(i) - 48;
  return out;
}

export function clueNumbers(sol, nbs, inv = null) {
  const out = new Uint8Array(sol.length);
  for (let i = 0; i < sol.length; i++) {
    let n = 0;
    for (const j of nbs[i]) if (sol[j] === sol[i]) n++;
    out[i] = inv && inv[i] === '1' ? nbs[i].length - n : n;
  }
  return out;
}

export function tallyTotals(sol, w, h, colour = 0) {
  const rows = new Uint8Array(h);
  const cols = new Uint8Array(w);
  for (let i = 0; i < w * h; i++) {
    if (sol[i] !== colour) continue;
    rows[(i / w) | 0]++;
    cols[i % w]++;
  }
  return { rows, cols };
}

export function prepare(p) {
  const N = p.w * p.h;
  const sol = parseSol(p.sol);
  const nbs = buildNeighbors(p.w, p.h, p.nb === 'mixed' ? 'king' : p.nb || 'king', !!p.wrap, p.nb === 'mixed' ? p.shapes : null);
  const nums = clueNumbers(sol, nbs, p.inv);
  const same = p.inv ? clueNumbers(sol, nbs) : nums;
  const inv = new Uint8Array(N);
  if (p.inv) for (let i = 0; i < N; i++) inv[i] = p.inv[i] === '1' ? 1 : 0;
  const partner = new Int32Array(N).fill(-1);
  if (p.sym) {
    for (let i = 0; i < N; i++) {
      const j = symPartner(i, p.w, p.h, p.sym);
      if (j !== i) partner[i] = j;
    }
  }
  const tally = p.tally ? tallyTotals(sol, p.w, p.h) : null;
  return { N, C: p.c, w: p.w, h: p.h, sol, nbs, nums, same, inv, partner, tally };
}

export function isEditable(kind) {
  return kind === '.' || kind === 'm';
}

export function hasClue(kind) {
  return kind === 'g' || kind === 'm';
}
