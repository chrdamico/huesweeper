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
      return s.src >= 0 ? [s.src] : [];
    case 'pair':
      return [s.srcA, s.srcB].filter((x) => x >= 0);
    case 'sym':
      return [s.from];
    default:
      return [];
  }
}

export function hintLines(h) {
  const s = h.step;
  if (!s) return [];
  return [s.tal, s.talA, s.talB].filter(Boolean);
}

function lineName(tal) {
  return tal[0] === 'r' ? 'row' : 'column';
}

export function hintText(h, prep, sw) {
  const s = h.step;
  const num = (src) => `<b class="hn${prep.inv[src] ? ' inv' : ''}">${prep.nums[src]}</b>`;
  const target = h.color == null ? '' : sw(h.color);
  const contrast = s && s.src >= 0 && prep.inv[s.src];
  switch (h.type) {
    case 'wrong':
      return 'This cell doesn\u2019t match the solution. Clear or repaint it.';
    case 'fill':
      if (s.tal) return `This ${lineName(s.tal)} needs all its open cells to be ${sw(s.k)} to reach its total.`;
      if (contrast) return `This ${num(s.src)} already sees enough other colours, so its open neighbours share its colour: ${sw(s.k)}.`;
      return `This ${num(s.src)} needs all its open neighbours to be ${sw(s.k)} to reach its count.`;
    case 'clear':
      if (s.tal) return `This ${lineName(s.tal)} already has its total of ${sw(s.k)}, so the rest aren\u2019t ${sw(s.k)}. This one is ${target}.`;
      if (contrast) return `This ${num(s.src)} needs every open neighbour to differ from its own colour ${sw(s.k)}. This one is ${target}.`;
      return `This ${num(s.src)} already has enough ${sw(s.k)} around it, so the rest aren\u2019t ${sw(s.k)}. This one is ${target}.`;
    case 'mask':
      return `This hidden clue ${num(s.src)} can only be ${target}: any other colour breaks its count.`;
    case 'pair':
      return `Compare these two clues. The cells they share settle this one: it\u2019s ${target}.`;
    case 'sym':
      return `The board is symmetric, so this cell copies its twin: ${target}.`;
    case 'trial':
      return `Suppose this cell were ${sw(s.k)}: the clues nearby would soon clash. So it\u2019s ${target}.`;
    default:
      return `This cell is ${target}.`;
  }
}
