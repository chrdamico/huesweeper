import { prepare } from '../public/js/board.js';
import { buildModel, solve } from '../public/js/solver.js';
import { CAMPAIGN } from '../public/js/levels-data.js';
import { WORLDS } from '../public/js/campaign.js';

export function effort(p) {
  const prep = prepare(p);
  const trace = [];
  solve(buildModel(prep, p.kind, p.tl), { maxLevel: 3, trace });
  let e = 0;
  for (const s of trace) {
    const w = s.t === 'trial' ? 8 : s.t === 'pair' ? 3 : s.t === 'mask' ? 2 : 1;
    e += w * Math.max(1, s.fixed.length ? 1 : 0);
  }
  return Math.round(e * (1 + 0.15 * (p.c - 2)));
}

const q = (a, f) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : '-';
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = [];
  CAMPAIGN.forEach((levels, w) => {
    const W = WORLDS[w];
    const groups = { orig: [], extra: [], ch: [] };
    for (const p of levels) {
      const n = +p.id.split('-')[1];
      const e = effort(p);
      const g = p.ch ? 'ch' : W.key <= 10 && n <= 8 ? 'orig' : 'extra';
      groups[g].push(e);
    }
    const f = (a) => (a.length ? `${String(q(a, 0.5)).padStart(3)} / ${String(q(a, 0.9)).padStart(3)} (n${a.length})` : '      -        ');
    rows.push(`${W.name.padEnd(16)} orig ${f(groups.orig)}   new ${f(groups.extra)}   challenge ${f(groups.ch)}`);
  });
  console.log('effort median / p90 per world');
  console.log(rows.join('\n'));
}
