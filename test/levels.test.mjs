import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, isEditable } from '../public/js/board.js';
import { buildModel } from '../public/js/solver.js';
import { findHint } from '../public/js/hint.js';
import { verifyPuzzle, generatePuzzle } from '../public/js/generator.js';
import { CAMPAIGN, GALLERY } from '../public/js/levels-data.js';
import { WORLDS } from '../public/js/campaign.js';
import { PICTURES, pictureSolution } from '../public/js/pictures.js';
import { dailyParams } from '../public/js/daily.js';

function playByHints(p) {
  const prep = prepare(p);
  const model = buildModel(prep, p.kind, p.tl);
  const board = new Int8Array(prep.N).fill(-1);
  for (let i = 0; i < prep.N; i++) if (!isEditable(p.kind[i])) board[i] = prep.sol[i];
  let steps = 0;
  while (board.some((v) => v < 0)) {
    const h = findHint(model, prep, board);
    assert.ok(h, `hint available in ${p.id}`);
    assert.notEqual(h.type, 'wrong');
    assert.equal(board[h.cell], -1);
    board[h.cell] = h.color;
    if (++steps > prep.N) throw new Error('too many steps');
  }
  assert.deepEqual(Array.from(board), Array.from(prep.sol));
}

test('campaign has every world and level, all uniquely solvable', () => {
  assert.equal(CAMPAIGN.length, WORLDS.length);
  CAMPAIGN.forEach((levels, w) => {
    assert.equal(levels.length, WORLDS[w].levels.length);
    for (const p of levels) {
      assert.ok(verifyPuzzle(p), p.id);
      playByHints(p);
    }
  });
});

test('gallery puzzles reproduce their pictures', () => {
  assert.equal(GALLERY.length, PICTURES.length);
  GALLERY.forEach((p, k) => {
    assert.equal(p.sol, pictureSolution(PICTURES[k]).join(''));
    assert.equal(p.palette.length, p.c);
    assert.ok(verifyPuzzle(p), p.id);
    playByHints(p);
  });
});

test('a week of daily puzzles generate and are solvable by hints', () => {
  for (let d = 1; d <= 7; d++) {
    const key = `2026-10-0${d}`;
    const { opts } = dailyParams(key);
    const p = generatePuzzle(opts);
    assert.ok(verifyPuzzle(p), key);
    playByHints({ ...p, id: key });
  }
});

test('hint flags a wrong cell first', () => {
  const p = CAMPAIGN[0][3];
  const prep = prepare(p);
  const model = buildModel(prep, p.kind, p.tl);
  const board = new Int8Array(prep.N).fill(-1);
  for (let i = 0; i < prep.N; i++) if (!isEditable(p.kind[i])) board[i] = prep.sol[i];
  const j = [...p.kind].lastIndexOf('.');
  board[j] = 1 - prep.sol[j];
  assert.deepEqual(findHint(model, prep, board), { type: 'wrong', cell: j });
});
