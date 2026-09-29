export const RULE_INFO = {
  classic: {
    label: 'Classic',
    desc: 'Each number counts how many of its 8 neighbours share its colour. Colour every empty cell so all numbers are right.',
  },
  c3: {
    label: '3 colours',
    desc: 'Three colours are in play. A number counts only neighbours of its own colour.',
  },
  c4: {
    label: '4 colours',
    desc: 'Four colours are in play. A number counts only neighbours of its own colour. Notes help you track what a cell can still be.',
  },
  mirror: {
    label: 'Mirror',
    desc: 'The solution is mirror-symmetric across the dotted line. Each cell has the same colour as its twin on the other side.',
  },
  rot: {
    label: 'Point symmetry',
    desc: 'The solution looks the same when you turn the board upside down. Each cell matches the cell opposite it through the centre.',
  },
  silent: {
    label: 'Silent',
    desc: 'Some given cells show a colour but no number. Their colour still counts for their neighbours.',
  },
  masks: {
    label: 'Masks',
    desc: 'Striped cells hide their colour but show a number. The number counts neighbours that share the hidden colour. Paint the cell once you know it.',
  },
  cross: {
    label: 'Cross',
    desc: 'Numbers count only the 4 cells directly above, below, left and right. Diagonals do not count.',
  },
  knight: {
    label: 'Knight',
    desc: 'Numbers count the cells a chess knight could jump to: two steps in one direction, then one step to the side.',
  },
  wrap: {
    label: 'Wrap',
    desc: 'The board wraps around. The left edge touches the right edge, and the top edge touches the bottom.',
  },
};

export function rulesOf(p) {
  const out = [];
  if (p.c === 3) out.push('c3');
  if (p.c === 4) out.push('c4');
  if (p.sym === 'mirror') out.push('mirror');
  if (p.sym === 'rot') out.push('rot');
  if (p.nb === 'cross') out.push('cross');
  if (p.nb === 'knight') out.push('knight');
  if (p.wrap) out.push('wrap');
  if (p.kind.includes('p')) out.push('silent');
  if (p.kind.includes('m')) out.push('masks');
  if (!out.length) out.push('classic');
  return out;
}

export const DIFF_NAMES = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
