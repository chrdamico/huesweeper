import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, mergeInto } from '../public/js/store.js';

const T0 = 1_000_000;

test('an older copy never removes progress', () => {
  const newer = normalize({ done: { 'w1-1': { t: 50, h: 0, at: T0 }, 'w1-2': { t: 80, h: 1, at: T0 + 5 } } });
  const stale = normalize({ done: { 'w1-1': { t: 90, h: 2, at: T0 - 50 } } });
  mergeInto(stale, newer);
  assert.deepEqual(Object.keys(stale.done).sort(), ['w1-1', 'w1-2']);
  assert.equal(stale.done['w1-1'].t, 50);
  assert.equal(stale.done['w1-1'].h, 0);
  const back = normalize({});
  mergeInto(back, stale);
  assert.equal(Object.keys(back.done).length, 2);
});

test('newest board save and newest settings win', () => {
  const a = normalize({ saves: { x: { b: 'old', u: T0 } }, settings: { palette: 'mono', _u: T0 } });
  const b = normalize({ saves: { x: { b: 'new', u: T0 + 1 } }, settings: { palette: 'sunset', _u: T0 + 1 } });
  mergeInto(a, b);
  assert.equal(a.saves.x.b, 'new');
  assert.equal(a.settings.palette, 'sunset');
  const c = normalize({ saves: { x: { b: 'older', u: T0 - 1 } }, settings: { palette: 'candy', _u: 0 } });
  mergeInto(a, c);
  assert.equal(a.saves.x.b, 'new');
  assert.equal(a.settings.palette, 'sunset');
});

test('a reset wins over progress made before it, not after', () => {
  const before = normalize({ done: { a: { t: 1, h: 0, at: T0 } }, daily: { history: { '2026-10-01': { t: 1, h: 0, at: T0 } } } });
  const reset = normalize({ resetAt: T0 + 10, done: { b: { t: 1, h: 0, at: T0 + 20 } } });
  mergeInto(before, reset);
  assert.deepEqual(Object.keys(before.done), ['b']);
  assert.deepEqual(Object.keys(before.daily.history), []);
  const other = normalize({ done: { a: { t: 1, h: 0, at: T0 } } });
  mergeInto(before, other);
  assert.deepEqual(Object.keys(before.done), ['b']);
});

test('daily history and endless counts merge without loss', () => {
  const a = normalize({ daily: { history: { d1: { t: 10, h: 0, at: T0 } } }, endless: { solved: { 1: 2, 2: 0, 3: 1 }, solvedAt: T0 } });
  const b = normalize({ daily: { history: { d2: { t: 20, h: 1, at: T0 } } }, endless: { solved: { 1: 1, 2: 4, 3: 0 }, solvedAt: T0 } });
  mergeInto(a, b);
  assert.deepEqual(Object.keys(a.daily.history).sort(), ['d1', 'd2']);
  assert.deepEqual(a.endless.solved, { 1: 2, 2: 4, 3: 1 });
});
