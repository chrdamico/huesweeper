export const NEIGHBORHOODS = {
  king: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
  cross: [[0, -1], [-1, 0], [1, 0], [0, 1]],
  knight: [[1, -2], [2, -1], [2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2]],
};

export function buildNeighbors(w, h, nb = 'king', wrap = false) {
  const offs = NEIGHBORHOODS[nb];
  const out = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
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

export function clueNumbers(sol, nbs) {
  const out = new Uint8Array(sol.length);
  for (let i = 0; i < sol.length; i++) {
    let n = 0;
    for (const j of nbs[i]) if (sol[j] === sol[i]) n++;
    out[i] = n;
  }
  return out;
}

export function prepare(p) {
  const N = p.w * p.h;
  const sol = parseSol(p.sol);
  const nbs = buildNeighbors(p.w, p.h, p.nb || 'king', !!p.wrap);
  const nums = clueNumbers(sol, nbs);
  const partner = new Int32Array(N).fill(-1);
  if (p.sym) {
    for (let i = 0; i < N; i++) {
      const j = symPartner(i, p.w, p.h, p.sym);
      if (j !== i) partner[i] = j;
    }
  }
  return { N, C: p.c, w: p.w, h: p.h, sol, nbs, nums, partner };
}

export function isEditable(kind) {
  return kind === '.' || kind === 'm';
}

export function hasClue(kind) {
  return kind === 'g' || kind === 'm';
}
