import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAMPAIGN } from '../public/js/levels-data.js';
import { WORLDS } from '../public/js/campaign.js';
import { hashString } from '../public/js/rng.js';
import { effort } from '../tools/difficulty-report.mjs';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/original-levels.json', import.meta.url)));
const byId = new Map(CAMPAIGN.flat().map((p) => [p.id, p]));
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

test('the original 80 levels are unchanged', () => {
  for (const [id, sig] of Object.entries(fixtures)) {
    const p = byId.get(id);
    assert.ok(p, `${id} exists`);
    const { ch, ...rest } = p;
    assert.equal(ch, undefined);
    assert.equal(hashString(JSON.stringify(rest)).toString(36), sig, `${id} unchanged`);
  }
});

test('new regular levels are not harder than the originals', () => {
  const origAll = [];
  CAMPAIGN.forEach((levels, w) => {
    const orig = levels.filter((p) => fixtures[p.id]).map(effort);
    origAll.push(...orig);
    const fresh = levels.filter((p) => !fixtures[p.id] && !p.ch).map(effort);
    if (!orig.length) return;
    assert.ok(Math.max(...fresh) <= Math.max(...orig) * 1.2, `${WORLDS[w].name}: hardest new ${Math.max(...fresh)} vs original ${Math.max(...orig)}`);
    assert.ok(median(fresh) <= median(orig) * 1.5, `${WORLDS[w].name}: median new ${median(fresh)} vs original ${median(orig)}`);
  });
  const newWorlds = CAMPAIGN.filter((levels) => !levels.some((p) => fixtures[p.id]));
  for (const levels of newWorlds) {
    const fresh = levels.filter((p) => !p.ch).map(effort);
    assert.ok(median(fresh) <= median(origAll) * 1.5, `median ${median(fresh)} vs ${median(origAll)}`);
  }
});

test('every world ends with exactly two challenge levels', () => {
  for (const levels of CAMPAIGN) {
    assert.equal(levels.filter((p) => p.ch).length, 2);
    assert.ok(levels.slice(-2).every((p) => p.ch));
  }
});
