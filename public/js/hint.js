import { solve } from './solver.js';

export function findHint(model, prep, board) {
  const { N, sol } = prep;
  const kind = model.kind;
  for (let i = 0; i < N; i++) {
    const k = kind[i];
    if ((k === '.' || k === 'm') && board[i] >= 0 && board[i] !== sol[i]) return { type: 'wrong', cell: i };
  }
  const dom = model.dom0.slice();
  for (let i = 0; i < N; i++) if (board[i] >= 0) dom[i] = 1 << board[i];
  const trace = [];
  solve(model, { maxLevel: 3, trace, dom });
  for (const step of trace) {
    for (const j of step.fixed) {
      if (board[j] >= 0) continue;
      return { type: step.t, cell: j, color: sol[j], step };
    }
  }
  return null;
}

export function hintSources(h) {
  const s = h.step;
  if (!s) return [];
  switch (s.t) {
    case 'fill':
    case 'clear':
    case 'mask':
      return [s.src];
    case 'pair':
      return [s.srcA, s.srcB];
    case 'sym':
      return [s.from];
    default:
      return [];
  }
}

export function hintText(h, prep, sw) {
  const s = h.step;
  const num = (src) => `<b class="hn">${prep.nums[src]}</b>`;
  const target = h.color == null ? '' : sw(h.color);
  switch (h.type) {
    case 'wrong':
      return 'This cell doesn’t match the solution. Clear or repaint it.';
    case 'fill':
      return `This ${num(s.src)} needs all its open neighbours to be ${sw(s.k)} to reach its count.`;
    case 'clear':
      return `This ${num(s.src)} already has enough ${sw(s.k)} around it, so the rest aren\u2019t ${sw(s.k)}. This one is ${target}.`;
    case 'mask':
      return `This hidden clue ${num(s.src)} can only be ${target}: any other colour breaks its count.`;
    case 'pair':
      return `Compare these two numbers. The cells they share settle this one: it’s ${target}.`;
    case 'sym':
      return `The board is symmetric, so this cell copies its twin: ${target}.`;
    case 'trial':
      return `Suppose this cell were ${sw(s.k)}: the numbers nearby would soon clash. So it’s ${target}.`;
    default:
      return `This cell is ${target}.`;
  }
}

