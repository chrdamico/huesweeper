import { textOn } from './palettes.js';
import { buildNeighbors, clueNumbers, parseSol } from './board.js';

export function miniBoard({ w, colors, cells, size = 18, gap = 2, axis = null, cls = '' }) {
  const vars = colors.map((c, k) => `--c${k}:${c};--t${k}:${textOn(c)}`).join(';');
  const body = cells
    .map((cell) => {
      const k = ['m-cell'];
      if (cell.c >= 0) k.push('col');
      if (cell.hl) k.push('hl');
      if (cell.src) k.push('src');
      if (cell.stripe) k.push('stripe');
      if (cell.dim) k.push('dim');
      if (cell.inset) k.push('inset');
      if (cell.tal) k.push('tal');
      if (cell.empty) k.push('empty');
      return `<i class="${k.join(' ')}"${cell.c >= 0 ? ` data-c="${cell.c}"` : ''}>${cell.n ?? ''}</i>`;
    })
    .join('');
  return `<div class="mini ${cls}" style="--w:${w};--mc:${size}px;--mg:${gap}px;${vars}">${body}${axis ? `<b class="m-axis m-${axis}"></b>` : ''}</div>`;
}

export function pictureMini(p, colors, size = 10, gap = 1) {
  const cells = [...p.sol].map((ch) => ({ c: +ch }));
  return miniBoard({ w: p.w, colors, cells, size, gap, cls: 'pic' });
}

export function silhouetteMini(p, size = 10, gap = 1) {
  const cells = [...p.kind].map(() => ({ c: -1 }));
  return miniBoard({ w: p.w, colors: [], cells, size, gap, cls: 'pic ghost' });
}

export function demo(rule, colors) {
  const make = (w, h, sol, opts = {}) => {
    const s = parseSol(sol.replace(/\s/g, ''));
    const nbs = buildNeighbors(w, h, opts.nb || 'king', !!opts.wrap);
    const nums = clueNumbers(s, nbs);
    const src = opts.src ?? -1;
    const hl = new Set(src >= 0 ? nbs[src] : []);
    const cells = [];
    for (let i = 0; i < w * h; i++) {
      const show = opts.show ? opts.show.includes(i) : true;
      const cell = { c: show ? s[i] : -1 };
      if (i === src) {
        cell.src = true;
        cell.n = nums[i];
        if (opts.stripe) {
          cell.c = -1;
          cell.stripe = true;
        }
        if (opts.inv) cell.n = `<span><b class="ne"></b>${nbs[i].length - nums[i]}</span>`;
        if (opts.mark) cell.n = `<span>${cell.n}<sup>${opts.mark}</sup></span>`;
      } else if (opts.nums?.includes(i)) cell.n = nums[i];
      if (src >= 0 && i !== src && !hl.has(i)) cell.dim = true;
      if (hl.has(i)) cell.hl = true;
      if (opts.inset?.includes(i)) cell.inset = true;
      cells.push(cell);
    }
    return miniBoard({ w, colors, cells, size: opts.size || 26, gap: 3, axis: opts.axis });
  };
  switch (rule) {
    case 'classic':
      return make(3, 3, '011 100 110', { src: 4 });
    case 'c3':
      return make(3, 3, '021 102 210', { src: 4 });
    case 'c4':
      return make(3, 3, '231 302 130', { src: 4 });
    case 'cross':
      return make(3, 3, '101 001 010', { src: 4, nb: 'cross' });
    case 'knight':
      return make(5, 5, '10110 01001 10010 00101 11010', { src: 12, nb: 'knight', size: 20 });
    case 'wrap':
      return make(4, 4, '0110 1001 0101 1010', { src: 0, wrap: true, size: 22 });
    case 'mirror':
      return make(4, 3, '0110 1001 1111', { axis: 'mirror', size: 22 });
    case 'rot':
      return make(3, 3, '001 101 100', { axis: 'rot', size: 24 });
    case 'masks':
      return make(3, 3, '011 100 110', { src: 4, stripe: true });
    case 'silent':
      return make(3, 3, '011 100 110', { nums: [0, 8], inset: [] });
    case 'diag':
      return make(3, 3, '001 110 100', { src: 4, nb: 'diag', mark: '\u00d7' });
    case 'contrast':
      return make(3, 3, '011 100 110', { src: 4, inv: true });
    case 'shapes':
      return make(5, 5, '10110 01001 10010 00101 11010', { src: 12, nb: 'cross', size: 20, mark: '+' });
    case 'tally': {
      const sol = [[0, 1, 0], [1, 1, 0], [0, 0, 0]];
      const cells = [{ c: -1, empty: true }];
      for (let x = 0; x < 3; x++) cells.push({ c: -1, tal: true, n: sol.filter((r) => r[x] === 0).length });
      for (let y = 0; y < 3; y++) {
        cells.push({ c: -1, tal: true, n: sol[y].filter((v) => v === 0).length });
        for (let x = 0; x < 3; x++) cells.push({ c: sol[y][x] });
      }
      return miniBoard({ w: 4, colors, cells, size: 24, gap: 3 });
    }
    default:
      return '';
  }
}
