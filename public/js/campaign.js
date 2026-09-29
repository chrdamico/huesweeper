const L = (w, h, diff, extra = {}) => ({ w, h, diff, ...extra });

export const WORLDS = [
  {
    id: 'basics',
    name: 'First Light',
    tagline: 'Two colours, eight neighbours',
    rules: {},
    levels: [L(4, 4, 1), L(5, 5, 1), L(5, 5, 1), L(6, 6, 1), L(6, 6, 2), L(7, 7, 2), L(7, 7, 2), L(8, 8, 2)],
    tips: [
      'Each number counts how many of its 8 neighbours share its colour. Colour every empty cell to match all the numbers.',
      'Tap a number to see which cells it counts. Pick a colour below, then tap or drag over empty cells.',
      'If a number already sees enough of its own colour, every other neighbour must be the other colour.',
      'If a number needs every empty neighbour to reach its count, they all share its colour.',
      'Stuck? The bulb shows one cell you can prove, and why.',
      'Compare two numbers that share cells. What one of them needs often settles the other.',
    ],
  },
  {
    id: 'mirror',
    name: 'Mirror',
    tagline: 'The picture is symmetric',
    rules: { sym: 'mirror' },
    intro: 'The solution is mirror-symmetric: every cell matches its twin across the dotted line. Later boards use point symmetry around the centre instead.',
    levels: [L(5, 5, 1), L(6, 6, 1), L(6, 6, 2), L(7, 7, 2), L(7, 7, 2, { sym: 'rot' }), L(8, 8, 2), L(8, 8, 3), L(9, 9, 3, { sym: 'rot' })],
  },
  {
    id: 'trio',
    name: 'Trio',
    tagline: 'Three colours',
    rules: { c: 3 },
    intro: 'Now there are three colours. A number still counts only neighbours of its own colour; the others can be either of the remaining two.',
    levels: [L(4, 4, 1), L(5, 5, 1), L(5, 5, 2), L(6, 6, 2), L(6, 6, 2), L(7, 7, 3), L(7, 7, 3), L(8, 8, 3)],
  },
  {
    id: 'hush',
    name: 'Hush',
    tagline: 'Some givens keep quiet',
    rules: { silent: true },
    intro: 'Some coloured cells show no number. Their colour still counts for their neighbours, but they give no count of their own.',
    levels: [L(5, 5, 1), L(6, 6, 1), L(6, 6, 2), L(7, 7, 2), L(7, 7, 2), L(8, 8, 3), L(8, 8, 3), L(9, 9, 3)],
  },
  {
    id: 'masks',
    name: 'Masks',
    tagline: 'Numbers with hidden colours',
    rules: { mystery: true },
    intro: 'Grey numbered cells hide their colour. The number counts neighbours that share the hidden colour. Work out the colour and paint it.',
    levels: [L(5, 5, 1), L(6, 6, 1), L(6, 6, 2), L(7, 7, 2), L(7, 7, 2), L(8, 8, 3), L(8, 8, 3), L(9, 9, 3)],
  },
  {
    id: 'cross',
    name: 'Crossroads',
    tagline: 'Only four neighbours',
    rules: { nb: 'cross' },
    intro: 'Numbers now count only the 4 cells directly above, below, left and right. Diagonals do not count.',
    levels: [L(5, 5, 1), L(5, 5, 1), L(6, 6, 2), L(6, 6, 2), L(7, 7, 2), L(7, 7, 3), L(8, 8, 3), L(8, 8, 3)],
  },
  {
    id: 'wrap',
    name: 'Wraparound',
    tagline: 'The edges connect',
    rules: { wrap: true },
    intro: 'The board wraps around: the left edge touches the right edge, and the top touches the bottom. Every number has 8 neighbours.',
    levels: [L(5, 5, 1), L(5, 5, 1), L(6, 6, 2), L(6, 6, 2), L(7, 7, 2), L(7, 7, 3), L(8, 8, 3), L(8, 8, 3)],
  },
  {
    id: 'knight',
    name: 'Knight',
    tagline: 'Count like a chess knight',
    rules: { nb: 'knight' },
    intro: 'Numbers count the cells a chess knight could jump to: two steps one way, one step to the side. Tap a number to see its cells.',
    levels: [L(5, 5, 1), L(5, 5, 1), L(6, 6, 2), L(6, 6, 2), L(7, 7, 2), L(7, 7, 3), L(8, 8, 3), L(8, 8, 3)],
  },
  {
    id: 'quartet',
    name: 'Quartet',
    tagline: 'Four colours',
    rules: { c: 4 },
    intro: 'Four colours. Use notes to track which colours a cell can still be.',
    levels: [L(4, 4, 1), L(5, 5, 1), L(5, 5, 2), L(6, 6, 2), L(6, 6, 2), L(7, 7, 3), L(7, 7, 3), L(8, 8, 3)],
  },
  {
    id: 'finale',
    name: 'Grand Mix',
    tagline: 'Rules combine',
    rules: {},
    intro: 'Every board here mixes two or more rules. Check the rule chips above the board.',
    levels: [
      L(7, 7, 2, { c: 3, sym: 'mirror' }),
      L(7, 7, 2, { silent: true, mystery: true }),
      L(6, 6, 2, { nb: 'knight', wrap: true }),
      L(7, 7, 3, { c: 3, nb: 'cross' }),
      L(7, 7, 3, { c: 3, mystery: true }),
      L(8, 8, 3, { wrap: true, sym: 'rot' }),
      L(7, 7, 3, { c: 4, silent: true }),
      L(9, 9, 3, { c: 3, sym: 'mirror', mystery: true }),
    ],
  },
];

export const WORLD_UNLOCK = 4;

export function levelId(w, l) {
  return `w${w + 1}-${l + 1}`;
}

export function worldRules(w, l) {
  return { ...WORLDS[w].rules, ...WORLDS[w].levels[l] };
}
