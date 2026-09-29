import { db, persist, resetAll } from './store.js';
import { WORLDS, WORLD_UNLOCK, levelId } from './campaign.js';
import { CAMPAIGN, GALLERY } from './levels-data.js';
import { Game, swatch } from './game.js';
import { icon } from './icons.js';
import { PALETTES, paletteFor, textOn } from './palettes.js';
import { RULE_INFO, rulesOf, DIFF_NAMES } from './rules-info.js';
import { initPWA, isStandalone, isIOS, canPrompt, promptInstall, onInstallChange } from './pwa.js';
import { generateAsync } from './gen-client.js';
import { dailyParams, dateKey, streak, lastDays } from './daily.js';
import { miniBoard, pictureMini, silhouetteMini, demo } from './mini.js';
import { sfx } from './sound.js';

const VERSION = '1.0.0';
const app = document.getElementById('app');
const sheetRoot = document.getElementById('sheet-root');
const toastEl = document.getElementById('toast');
let game = null;
let cleanupFns = [];
let rendered = null;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

function colors() {
  return (PALETTES[db.settings.palette] || PALETTES.candy).colors;
}

function paletteVars(cols = colors()) {
  return cols.map((c, k) => `--c${k}:${c};--t${k}:${textOn(c)}`).join(';');
}

function applyTheme() {
  const t = db.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  document.documentElement.classList.toggle('cb', !!db.settings.symbols);
  document.body.style.cssText = paletteVars();
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    if (!m.dataset.media) m.dataset.media = m.media || '';
    if (t === 'auto') {
      m.media = m.dataset.media;
      m.content = m.dataset.media.includes('dark') ? '#15151C' : '#F4F1EA';
    } else {
      m.media = '';
      m.content = bg;
    }
  }
}

function go(path, replace = false) {
  const url = `#/${path}`;
  if (replace) history.replaceState({ app: !!history.state?.app }, '', url);
  else history.pushState({ app: true }, '', url);
  route();
}

function back(parent) {
  if (history.state?.app) history.back();
  else go(parent, true);
}

function cleanup() {
  closeSheet();
  if (game) {
    game.save();
    game.destroy();
    game = null;
  }
  cleanupFns.forEach((f) => f());
  cleanupFns = [];
}

const ROUTES = [
  [/^$/, homeScreen],
  [/^campaign$/, campaignScreen],
  [/^world\/(\d+)$/, worldScreen],
  [/^play\/([\w-]+)$/, playScreen],
  [/^gallery$/, galleryScreen],
  [/^daily$/, dailyScreen],
  [/^endless$/, endlessScreen],
  [/^howto$/, howtoScreen],
  [/^settings$/, settingsScreen],
];

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === rendered) return;
  rendered = h;
  cleanup();
  window.scrollTo(0, 0);
  for (const [re, fn] of ROUTES) {
    const m = h.match(re);
    if (m) {
      fn(...m.slice(1));
      return;
    }
  }
  homeScreen();
}

function rerender() {
  rendered = null;
  route();
}

function screen(cls, { title = '', parent = null, right = '' }, body) {
  app.innerHTML = `<section class="screen scr-${cls}">
    <header class="topbar">
      ${parent != null ? `<button class="icon-btn" data-back aria-label="Back">${icon('back')}</button>` : '<span class="icon-btn ghost"></span>'}
      <h1 class="tb-title">${title}</h1>
      ${right || '<span class="icon-btn ghost"></span>'}
    </header>
    <div class="content">${body}</div>
  </section>`;
  const el = app.firstElementChild;
  el.querySelector('[data-back]')?.addEventListener('click', () => back(parent));
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go]');
    if (t && !t.disabled) {
      sfx.tap();
      go(t.dataset.go);
    }
  });
  return el;
}

let sheetClose = null;

function closeSheet() {
  if (sheetClose) sheetClose();
}

function sheet({ title = '', html = '', actions = [], dismissable = true, cls = '' }) {
  closeSheet();
  sheetRoot.innerHTML = `<div class="sheet-backdrop"></div>
    <div class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grab"></div>
      ${title ? `<h2 class="sheet-title">${title}</h2>` : ''}
      <div class="sheet-body">${html}</div>
      ${actions.length ? `<div class="sheet-actions">${actions.map((a, n) => `<button class="btn ${a.kind || ''}" data-n="${n}">${a.label}</button>`).join('')}</div>` : ''}
    </div>`;
  const sh = sheetRoot.querySelector('.sheet');
  requestAnimationFrame(() => sheetRoot.classList.add('open'));
  const close = () => {
    if (sheetClose !== close) return;
    sheetClose = null;
    sheetRoot.classList.remove('open');
    const node = sheetRoot.innerHTML;
    setTimeout(() => {
      if (sheetRoot.innerHTML === node && !sheetRoot.classList.contains('open')) sheetRoot.innerHTML = '';
    }, 260);
  };
  sheetClose = close;
  sheetRoot.querySelector('.sheet-backdrop').addEventListener('click', () => dismissable && close());
  sh.querySelector('.sheet-actions')?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-n]');
    if (!b) return;
    const a = actions[+b.dataset.n];
    if (a.close !== false) close();
    a.onClick?.();
  });
  return { el: sh, close };
}

let toastTimer = 0;

function toast(msg, { action, onAction, ms = 2800 } = {}) {
  clearTimeout(toastTimer);
  toastEl.innerHTML = `<span>${msg}</span>${action ? `<button class="toast-btn">${action}</button>` : ''}`;
  toastEl.classList.add('show');
  toastEl.querySelector('.toast-btn')?.addEventListener('click', () => {
    toastEl.classList.remove('show');
    onAction?.();
  });
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

function ruleSheet(rule) {
  const info = RULE_INFO[rule];
  sheet({
    title: info.label,
    html: `<div class="rule-demo">${demo(rule, colors())}</div><p>${info.desc}</p>`,
    actions: [{ label: 'Got it', kind: 'primary' }],
  });
}

function worldSolved(w) {
  return CAMPAIGN[w].filter((p) => db.done[p.id]).length;
}

function worldUnlocked(w) {
  return w === 0 || worldSolved(w - 1) >= WORLD_UNLOCK;
}

function levelUnlocked(w, l) {
  return worldUnlocked(w) && (l === 0 || !!db.done[CAMPAIGN[w][l - 1].id] || !!db.done[CAMPAIGN[w][l].id]);
}

function nextCampaignLevel() {
  for (let w = 0; w < CAMPAIGN.length; w++) {
    if (!worldUnlocked(w)) continue;
    for (let l = 0; l < CAMPAIGN[w].length; l++) {
      if (!db.done[CAMPAIGN[w][l].id] && levelUnlocked(w, l)) return { w, l };
    }
  }
  return null;
}

function parseLevel(id) {
  const m = id.match(/^w(\d+)-(\d+)$/);
  if (!m) return null;
  const w = +m[1] - 1;
  const l = +m[2] - 1;
  if (!CAMPAIGN[w] || !CAMPAIGN[w][l]) return null;
  return { w, l };
}

function totalSolved() {
  return CAMPAIGN.flat().filter((p) => db.done[p.id]).length;
}

function logoHtml() {
  const tiles = [
    [0, ''], [1, ''], [0, ''],
    [1, ''], [0, '3'], [1, ''],
    [0, ''], [1, ''], [1, ''],
  ];
  return `<div class="logo-board">${tiles.map(([c, n], i) => `<i data-c="${c}" style="--i:${i}">${n}</i>`).join('')}</div>`;
}

function installButtonHtml() {
  if (isStandalone()) return '';
  return `<button class="btn ghost install-btn">${icon('download')}Install app</button>`;
}

function wireInstall(el) {
  const b = el.querySelector('.install-btn');
  if (!b) return;
  b.addEventListener('click', async () => {
    if (canPrompt()) {
      const ok = await promptInstall();
      if (ok) toast('Installing… Look for Huesweeper on your home screen.');
      return;
    }
    const ios = isIOS();
    sheet({
      title: 'Install Huesweeper',
      html: ios
        ? `<ol class="steps"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button ${icon('share', 'inline')}.</li><li>Choose <b>Add to Home Screen</b>.</li></ol><p class="muted">It then opens full-screen and works offline.</p>`
        : `<ol class="steps"><li>Open your browser menu (<b>⋮</b>).</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li></ol><p class="muted">Huesweeper then runs full-screen and works offline.</p>`,
      actions: [{ label: 'OK', kind: 'primary' }],
    });
  });
}

function homeScreen() {
  const next = nextCampaignLevel();
  const last = db.last && !db.done[db.last] && (parseLevel(db.last) || GALLERY.some((g) => g.id === db.last)) ? db.last : null;
  const target = last || (next ? CAMPAIGN[next.w][next.l].id : null);
  let label = 'Play';
  if (target) {
    const pl = parseLevel(target);
    label = pl ? `${WORLDS[pl.w].name} · Level ${pl.l + 1}` : GALLERY.find((g) => g.id === target)?.title ? 'Gallery puzzle' : 'Play';
  }
  const today = dateKey();
  const dailyDone = !!db.daily.history[today];
  const st = streak(db.daily.history, today);
  const gDone = GALLERY.filter((g) => db.done[g.id]).length;
  const total = CAMPAIGN.flat().length;
  const el = screen(
    'home',
    { right: `<button class="icon-btn" data-go="settings" aria-label="Settings">${icon('settings')}</button>` },
    `<div class="hero">
      ${logoHtml()}
      <div class="wordmark">Hue<span>sweeper</span></div>
      <p class="tagline">Paint every cell. Make every number true.</p>
    </div>
    <button class="btn primary big play-btn" ${target ? `data-go="play/${target}"` : 'data-go="endless"'}>
      ${icon('play')}<span><small>${last ? 'Continue' : totalSolved() ? 'Next up' : 'Start'}</small>${target ? label : 'Endless mode'}</span>
    </button>
    <div class="modes">
      <button class="mode" data-go="campaign" style="--mc:var(--c1)">${icon('map')}<b>Campaign</b><span>${totalSolved()} / ${total}</span></button>
      <button class="mode" data-go="daily" style="--mc:var(--c0)">${icon('calendar')}<b>Daily</b><span>${dailyDone ? `Done${st > 1 ? ` · ${st} days` : ''}` : st ? `${st}-day streak` : 'New puzzle'}</span></button>
      <button class="mode" data-go="endless" style="--mc:var(--c3)">${icon('infinity')}<b>Endless</b><span>Your rules</span></button>
      <button class="mode" data-go="gallery" style="--mc:var(--c2)">${icon('image')}<b>Gallery</b><span>${gDone} / ${GALLERY.length} pictures</span></button>
    </div>
    <div class="home-foot">
      <button class="btn ghost" data-go="howto">${icon('help')}How to play</button>
      ${installButtonHtml()}
    </div>`,
  );
  wireInstall(el);
  cleanupFns.push(onInstallChange(() => rendered === '' && rerender()));
}

function campaignScreen() {
  const cards = WORLDS.map((W, w) => {
    const open = worldUnlocked(w);
    const n = worldSolved(w);
    const len = CAMPAIGN[w].length;
    return `<button class="world-card ${open ? '' : 'locked'}" ${open ? `data-go="world/${w}"` : 'disabled'} style="--wc:var(--c${w % 4});--wt:var(--t${w % 4})">
      <span class="w-num">${open ? w + 1 : icon('lock')}</span>
      <span class="w-body"><b>${W.name}</b><small>${open ? W.tagline : `Solve ${WORLD_UNLOCK} in ${WORLDS[w - 1].name} to unlock`}</small>
        <span class="bar"><i style="width:${(n / len) * 100}%"></i></span></span>
      <span class="w-count">${n === len ? icon('check') : `${n}/${len}`}</span>
    </button>`;
  }).join('');
  screen('campaign', { title: 'Campaign', parent: '' }, `<div class="worlds">${cards}</div>`);
}

function worldScreen(ws) {
  const w = +ws;
  if (!WORLDS[w] || !worldUnlocked(w)) return go('campaign', true);
  const W = WORLDS[w];
  const rules = rulesOf({ ...CAMPAIGN[w][0], kind: CAMPAIGN[w].map((p) => p.kind).join('') });
  const tiles = CAMPAIGN[w].map((p, l) => {
    const d = db.done[p.id];
    const open = levelUnlocked(w, l);
    const cur = open && !d && (l === 0 || db.done[CAMPAIGN[w][l - 1].id]);
    return `<button class="lvl ${d ? 'done' : ''} ${cur ? 'cur' : ''}" ${open ? `data-go="play/${p.id}"` : 'disabled'} aria-label="Level ${l + 1}">
      <b>${open ? l + 1 : icon('lock')}</b>
      <small>${p.w}×${p.h}</small>
      ${d ? `<span class="lvl-badge">${d.h ? icon('check') : icon('star')}</span>` : ''}
    </button>`;
  }).join('');
  const el = screen(
    'world',
    { title: W.name, parent: 'campaign' },
    `<div class="card intro">
      <div class="rule-demo">${demo(rules.find((r) => r !== 'classic') || 'classic', colors())}</div>
      <div><h3>${W.tagline}</h3><p>${W.intro || RULE_INFO.classic.desc}</p>
      <div class="chips">${rules.map((r) => `<button class="chip" data-rule="${r}">${RULE_INFO[r].label}${icon('info', 'chip-i')}</button>`).join('')}</div></div>
    </div>
    <div class="levels">${tiles}</div>`,
  );
  el.querySelector('.chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (b) ruleSheet(b.dataset.rule);
  });
}

function galleryScreen() {
  const cards = GALLERY.map((g) => {
    const d = db.done[g.id];
    return `<button class="pic-card ${d ? 'done' : ''}" data-go="play/${g.id}">
      <span class="pic-frame">${d ? pictureMini(g, g.palette, 12, 1) : silhouetteMini(g, 12, 1)}${d ? '' : '<span class="q">?</span>'}</span>
      <b>${d ? esc(g.title) : '???'}</b>
      <small>${g.w}×${g.h} · ${g.c} colours</small>
    </button>`;
  }).join('');
  screen('gallery', { title: 'Gallery', parent: '' }, `<p class="lead">Each puzzle hides a little picture. Solve it to hang it on the wall.</p><div class="pics">${cards}</div>`);
}

function dailyScreen() {
  const today = dateKey();
  const { name, opts } = dailyParams(today);
  const doneToday = db.daily.history[today];
  const st = streak(db.daily.history, today);
  const days = lastDays(7, today);
  const fake = { ...opts, kind: opts.silent ? 'p' : opts.mystery ? 'm' : '' };
  const rules = rulesOf(fake);
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const el = screen(
    'daily',
    { title: 'Daily puzzle', parent: '' },
    `<div class="card daily-card">
      <div class="daily-date">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      <h2>${name}</h2>
      <div class="chips">${rules.map((r) => `<button class="chip" data-rule="${r}">${RULE_INFO[r].label}${icon('info', 'chip-i')}</button>`).join('')}
        <span class="chip plain">${opts.w}×${opts.h}</span><span class="chip plain">${DIFF_NAMES[opts.diff]}</span></div>
      ${doneToday
        ? `<p class="done-line">${icon('check')} Solved in <b>${fmtTime(doneToday.t)}</b>${doneToday.h ? ` with ${doneToday.h} hint${doneToday.h > 1 ? 's' : ''}` : ', no hints'}.</p>
           <div class="row"><button class="btn primary share-btn">${icon('share')}Share</button><button class="btn" data-go="play/daily">View board</button></div>`
        : `<button class="btn primary big daily-play">${icon('play')}<span>${db.saves[`daily-${today}`] ? 'Continue' : 'Play today’s puzzle'}</span></button>`}
    </div>
    <div class="card streak-card">
      <div class="streak">${icon('flame')}<b>${st}</b><span>day streak</span></div>
      <div class="week">${days.map((d) => {
        const dt = new Date(d + 'T12:00');
        return `<span class="day ${db.daily.history[d] ? 'on' : ''} ${d === today ? 'today' : ''}"><i></i><small>${dayNames[dt.getDay()]}</small></span>`;
      }).join('')}</div>
    </div>
    <p class="muted center">A new puzzle every day at midnight. Everyone gets the same board.</p>`,
  );
  el.querySelector('.chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip[data-rule]');
    if (b) ruleSheet(b.dataset.rule);
  });
  el.querySelector('.share-btn')?.addEventListener('click', () => shareDaily(today));
  const pb = el.querySelector('.daily-play');
  pb?.addEventListener('click', async () => {
    pb.disabled = true;
    pb.querySelector('span').textContent = 'Preparing…';
    try {
      await ensureDaily(today);
      go('play/daily');
    } catch (err) {
      pb.disabled = false;
      toast('Could not create the puzzle. Try again.');
      console.error(err);
    }
  });
}

async function ensureDaily(key) {
  if (db.daily.cache?.key === key && db.daily.cache.puzzle) return db.daily.cache.puzzle;
  const { name, opts } = dailyParams(key);
  const puzzle = await generateAsync(opts);
  db.daily.cache = { key, name, puzzle };
  persist();
  return puzzle;
}

function shareDaily(key) {
  const d = db.daily.history[key];
  if (!d) return;
  const { name } = dailyParams(key);
  const cols = ['🟥', '🟦', '🟨', '🟩'];
  const bar = Array.from({ length: 5 }, (_, i) => cols[i % 4]).join('');
  const text = `Huesweeper daily ${key}\n${name}\n${bar}\n⏱ ${fmtTime(d.t)} · ${d.h ? `${d.h} hint${d.h > 1 ? 's' : ''}` : 'no hints ⭐'}\n${location.origin}${location.pathname}`;
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else {
    navigator.clipboard?.writeText(text).then(() => toast('Result copied to clipboard'), () => toast(text.replace(/\n/g, ' ')));
  }
}

const SIZES = [
  { id: 's', label: '5×5', w: 5, h: 5 },
  { id: 'm', label: '7×7', w: 7, h: 7 },
  { id: 'l', label: '9×9', w: 9, h: 9 },
  { id: 'xl', label: '9×13', w: 9, h: 13 },
];

const ENDLESS_DEFAULT = { size: 'm', diff: 2, c: 2, nb: 'king', sym: '', wrap: false, silent: false, mystery: false };

function endlessOpts() {
  return { ...ENDLESS_DEFAULT, ...(db.endless.opts || {}) };
}

function seg(name, options, value) {
  return `<div class="seg" data-name="${name}">${options
    .map(([v, label]) => `<button class="${String(v) === String(value) ? 'sel' : ''}" data-v="${v}">${label}</button>`)
    .join('')}</div>`;
}

function toggle(name, label, desc, on) {
  return `<label class="toggle-row"><span><b>${label}</b><small>${desc}</small></span><input type="checkbox" data-name="${name}" ${on ? 'checked' : ''}><i class="switch"></i></label>`;
}

function endlessScreen() {
  const o = endlessOpts();
  const cur = db.endless.puzzle;
  const curSolved = cur && db.done[`endless-${cur.seed}`];
  const solved = db.endless.solved || {};
  const el = screen(
    'endless',
    { title: 'Endless', parent: '' },
    `${cur && !curSolved ? `<button class="btn big resume" data-go="play/endless">${icon('play')}<span><small>Resume</small>${cur.w}×${cur.h} · ${DIFF_NAMES[cur.diff]}</span></button>` : ''}
    <div class="card form">
      <h3>Board</h3>
      ${seg('size', SIZES.map((s) => [s.id, s.label]), o.size)}
      <h3>Difficulty</h3>
      ${seg('diff', [[1, 'Easy'], [2, 'Medium'], [3, 'Hard']], o.diff)}
      <h3>Colours</h3>
      ${seg('c', [[2, 'Two'], [3, 'Three'], [4, 'Four']], o.c)}
      <h3>Numbers count</h3>
      ${seg('nb', [['king', '8 around'], ['cross', '4 sides'], ['knight', 'Knight']], o.nb)}
      <h3>Symmetry</h3>
      ${seg('sym', [['', 'None'], ['mirror', 'Mirror'], ['rot', 'Point']], o.sym)}
      <div class="toggles">
        ${toggle('wrap', 'Wraparound', 'Edges connect to the opposite side', o.wrap)}
        ${toggle('silent', 'Silent cells', 'Some givens show no number', o.silent)}
        ${toggle('mystery', 'Masks', 'Some numbers hide their colour', o.mystery)}
      </div>
    </div>
    <div class="row sticky-actions">
      <button class="btn surprise">${icon('dice')}Surprise me</button>
      <button class="btn primary new-btn">${icon('refresh')}New puzzle</button>
    </div>
    <p class="muted center">Solved: ${solved[1] || 0} easy · ${solved[2] || 0} medium · ${solved[3] || 0} hard</p>`,
  );
  const form = el.querySelector('.form');
  form.addEventListener('click', (e) => {
    const b = e.target.closest('.seg button');
    if (!b) return;
    const segEl = b.parentNode;
    for (const x of segEl.children) x.classList.toggle('sel', x === b);
    const name = segEl.dataset.name;
    const v = b.dataset.v;
    o[name] = name === 'diff' || name === 'c' ? +v : v;
    db.endless.opts = o;
    persist();
    sfx.tap();
  });
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.name) {
      o[t.dataset.name] = t.checked;
      db.endless.opts = o;
      persist();
    }
  });
  const start = async (opts) => {
    const btn = el.querySelector('.new-btn');
    btn.disabled = true;
    btn.lastChild.textContent = 'Creating…';
    const size = SIZES.find((s) => s.id === opts.size) || SIZES[1];
    const params = {
      w: size.w,
      h: size.h,
      c: opts.c,
      diff: opts.diff,
      nb: opts.nb,
      sym: opts.sym || null,
      wrap: opts.wrap,
      silent: opts.silent,
      mystery: opts.mystery,
      seed: (Math.random() * 2 ** 31) >>> 0,
      attempts: 6,
    };
    try {
      const p = await generateAsync(params);
      db.endless.puzzle = p;
      persist();
      go('play/endless');
    } catch (err) {
      console.error(err);
      toast('Could not create a puzzle. Try other settings.');
      btn.disabled = false;
      btn.lastChild.textContent = 'New puzzle';
    }
  };
  el.querySelector('.new-btn').addEventListener('click', () => start(o));
  el.querySelector('.surprise').addEventListener('click', () => {
    const r = (a) => a[Math.floor(Math.random() * a.length)];
    const s = {
      size: r(['m', 'm', 'l', 'xl']),
      diff: r([2, 3, 3]),
      c: r([2, 2, 3, 4]),
      nb: r(['king', 'king', 'king', 'cross', 'knight']),
      sym: r(['', '', 'mirror', 'rot']),
      wrap: Math.random() < 0.25,
      silent: Math.random() < 0.25,
      mystery: Math.random() < 0.3,
    };
    start(s);
  });
}

function howtoScreen() {
  const cols = colors();
  const el = screen(
    'howto',
    { title: 'How to play', parent: '' },
    `<div class="card howto-card">
      <div class="rule-demo">${demo('classic', cols)}</div>
      <div><h3>The goal</h3>
      <p>Colour every empty cell. Each <b>number</b> tells you how many of its <b>8 neighbours</b> have the <b>same colour as the number’s own cell</b>.</p>
      <p class="muted">Here the centre ${swatch(0)} cell shows 3: exactly three of the cells around it are ${swatch(0)}.</p></div>
    </div>
    <div class="card">
      <h3>Controls</h3>
      <ul class="bullets">
        <li><b>Pick a colour</b> at the bottom, then tap an empty cell. Drag to paint several cells.</li>
        <li><b>Tap the same colour</b> on a painted cell to clear it, or use the eraser.</li>
        <li><b>Tap a number</b> to light up the cells it counts. Press and hold a striped cell to do the same.</li>
        <li><b>Notes</b> (${icon('pencil', 'inline')}) put small dots in a cell to track colours it could be.</li>
        <li><b>Hint</b> (${icon('bulb', 'inline')}) shows a cell you can prove and why. Tap it again to fill it in.</li>
        <li>A number turns <span class="err-demo">red</span> when it can no longer be right.</li>
      </ul>
    </div>
    <div class="card">
      <h3>Tactics</h3>
      <ul class="bullets">
        <li><b>Full:</b> if a number already sees its count of its own colour, all its other neighbours are a different colour.</li>
        <li><b>Hungry:</b> if a number needs every open neighbour to reach its count, they all share its colour.</li>
        <li><b>Overlap:</b> two numbers that share cells limit each other. What one needs from the shared cells can settle the rest.</li>
        <li><b>What if:</b> suppose a colour for a cell and follow the numbers. If something breaks, the cell is a different colour.</li>
      </ul>
      <p class="muted">Every puzzle has one solution, and you never need to guess.</p>
    </div>
    <h3 class="section">Rules you will meet</h3>
    <div class="rule-list">${['c3', 'mirror', 'rot', 'silent', 'masks', 'cross', 'wrap', 'knight']
      .map((r) => `<div class="card rule-item"><div class="rule-demo">${demo(r, cols)}</div><div><h3>${RULE_INFO[r].label}</h3><p>${RULE_INFO[r].desc}</p></div></div>`)
      .join('')}</div>
    <button class="btn primary big" data-go="${CAMPAIGN[0][0].id ? `play/${CAMPAIGN[0][0].id}` : 'campaign'}">${icon('play')}<span>Try the first puzzle</span></button>`,
  );
  void el;
}

function settingsScreen() {
  const s = db.settings;
  const pal = Object.entries(PALETTES)
    .map(([id, p]) => `<button class="pal ${s.palette === id ? 'sel' : ''}" data-pal="${id}"><span class="pal-sw">${p.colors.map((c) => `<i style="background:${c}"></i>`).join('')}</span><b>${p.name}</b></button>`)
    .join('');
  const el = screen(
    'settings',
    { title: 'Settings', parent: '' },
    `<div class="card form">
      <h3>Theme</h3>
      ${seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], s.theme)}
      <h3>Colours</h3>
      <div class="pals">${pal}</div>
      <div class="toggles">
        ${toggle('symbols', 'Colour symbols', 'Add a shape to each colour', s.symbols)}
        ${toggle('errors', 'Show mistakes', 'Numbers turn red when they can’t be right', s.errors)}
        ${toggle('cycle', 'Tap to cycle', 'Each tap moves a cell to the next colour', s.cycle)}
        ${toggle('sound', 'Sound', 'Soft clicks and chimes', s.sound)}
        ${'vibrate' in navigator ? toggle('vibrate', 'Vibration', 'Light haptic taps', s.vibrate) : ''}
      </div>
    </div>
    <div class="card">
      <h3>App</h3>
      <div class="row wrap">${installButtonHtml()}<button class="btn danger reset-btn">${icon('restart')}Reset progress</button></div>
      <p class="muted small">Huesweeper ${VERSION}. Progress stays on this device. A fan-made puzzle inspired by <i>ColorSweeper</i>. Font: Nunito (SIL OFL).</p>
    </div>`,
  );
  const form = el.querySelector('.form');
  form.addEventListener('click', (e) => {
    const b = e.target.closest('.seg button');
    if (b) {
      for (const x of b.parentNode.children) x.classList.toggle('sel', x === b);
      s.theme = b.dataset.v;
      persist();
      applyTheme();
      return;
    }
    const p = e.target.closest('.pal');
    if (p) {
      s.palette = p.dataset.pal;
      for (const x of form.querySelectorAll('.pal')) x.classList.toggle('sel', x === p);
      persist();
      applyTheme();
      sfx.tap();
    }
  });
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (!t.dataset.name) return;
    s[t.dataset.name] = t.checked;
    persist();
    applyTheme();
    if (t.checked && t.dataset.name === 'sound') sfx.paint(0);
  });
  wireInstall(el);
  el.querySelector('.reset-btn').addEventListener('click', () => {
    sheet({
      title: 'Reset all progress?',
      html: '<p>This clears solved levels, saved boards and your daily streak on this device. Settings stay.</p>',
      actions: [
        { label: 'Cancel' },
        {
          label: 'Reset',
          kind: 'danger',
          onClick: () => {
            resetAll();
            toast('Progress reset');
          },
        },
      ],
    });
  });
}

function playScreen(id) {
  let puzzle;
  let title;
  let parent;
  let tip = '';
  let saveKey = id;
  let mode;
  let pl = null;
  if ((pl = parseLevel(id))) {
    if (!levelUnlocked(pl.w, pl.l)) return go(`world/${pl.w}`, true);
    mode = 'campaign';
    puzzle = CAMPAIGN[pl.w][pl.l];
    title = `${WORLDS[pl.w].name} <span>· ${pl.l + 1}</span>`;
    parent = `world/${pl.w}`;
    if (pl.w === 0) tip = WORLDS[0].tips[pl.l] || '';
  } else if (id.startsWith('g-')) {
    mode = 'gallery';
    puzzle = GALLERY.find((g) => g.id === id);
    if (!puzzle) return go('gallery', true);
    title = db.done[id] ? esc(puzzle.title) : 'Mystery picture';
    parent = 'gallery';
  } else if (id === 'daily') {
    mode = 'daily';
    const key = dateKey();
    if (db.daily.cache?.key !== key) return go('daily', true);
    puzzle = db.daily.cache.puzzle;
    title = 'Daily';
    parent = 'daily';
    saveKey = `daily-${key}`;
  } else if (id === 'endless') {
    mode = 'endless';
    puzzle = db.endless.puzzle;
    if (!puzzle) return go('endless', true);
    title = `Endless <span>· ${DIFF_NAMES[puzzle.diff]}</span>`;
    parent = 'endless';
    saveKey = `endless-${puzzle.seed}`;
  } else return go('', true);

  if (mode === 'campaign' || mode === 'gallery') {
    db.last = id;
    persist();
  }
  const el = screen('play', { title, parent, right: `<button class="icon-btn help-btn" aria-label="Rules">${icon('help')}</button>` }, '<div class="game-host"></div>');
  const host = el.querySelector('.game-host');
  const saves = db.saves;
  const restartSheet = () =>
    sheet({
      title: 'Restart puzzle?',
      html: '<p>All your painted cells and notes on this board are cleared.</p>',
      actions: [{ label: 'Cancel' }, { label: 'Restart', kind: 'primary', onClick: () => game?.restart() }],
    });
  game = new Game(puzzle, {
    colors: paletteFor(puzzle, db.settings),
    settings: db.settings,
    saved: saves[saveKey],
    tip,
    onRule: ruleSheet,
    onRestart: restartSheet,
    onSave: (state) => {
      saves[saveKey] = state;
      persist();
    },
    onWin: (res) => onWin(mode, id, puzzle, res, pl),
  });
  game.mount(host);
  if (mode === 'campaign' && pl.w === 0 && pl.l < 2 && !saves[saveKey] && !db.done[id]) game.demoFocus();
  el.querySelector('.help-btn').addEventListener('click', () => {
    const rules = rulesOf(puzzle);
    sheet({
      title: 'Rules for this board',
      html: rules
        .map((r) => `<div class="rule-item compact"><div class="rule-demo">${demo(r, paletteFor(puzzle, db.settings))}</div><div><h3>${RULE_INFO[r].label}</h3><p>${RULE_INFO[r].desc}</p></div></div>`)
        .join(''),
      actions: [{ label: 'Full guide', onClick: () => go('howto') }, { label: 'Close', kind: 'primary' }],
    });
  });
  if (mode === 'campaign' && pl.l === 0 && pl.w > 0 && !db.seen[WORLDS[pl.w].id] && !db.done[id]) {
    db.seen[WORLDS[pl.w].id] = 1;
    persist();
    const r = rulesOf(puzzle).find((x) => x !== 'classic') || 'classic';
    sheet({
      title: `New rule: ${RULE_INFO[r].label}`,
      html: `<div class="rule-demo">${demo(r, paletteFor(puzzle, db.settings))}</div><p>${WORLDS[pl.w].intro}</p>`,
      actions: [{ label: 'Let’s go', kind: 'primary' }],
    });
  }
}

function recordDone(key, res) {
  const prev = db.done[key];
  db.done[key] = {
    t: prev ? Math.min(prev.t, res.time) : Math.round(res.time),
    h: prev ? Math.min(prev.h, res.hints) : res.hints,
    at: Date.now(),
  };
  persist();
  return !prev;
}

function onWin(mode, id, puzzle, res, pl) {
  const g = game;
  const show = (o) => setTimeout(() => game === g && g && sheet(o), 1400);
  const stats = `<div class="win-stats"><span>${icon('clock')}${fmtTime(res.time)}</span><span>${res.hints ? `${icon('bulb')}${res.hints} hint${res.hints > 1 ? 's' : ''}` : `${icon('star')}No hints`}</span></div>`;
  if (mode === 'campaign') {
    const wasUnlocked = pl.w + 1 < WORLDS.length && worldUnlocked(pl.w + 1);
    recordDone(id, res);
    const nowUnlocked = pl.w + 1 < WORLDS.length && worldUnlocked(pl.w + 1);
    const isLast = pl.l + 1 >= CAMPAIGN[pl.w].length;
    const actions = [{ label: 'Levels', onClick: () => go(`world/${pl.w}`, true) }];
    if (!isLast) actions.push({ label: 'Next level', kind: 'primary', onClick: () => go(`play/${CAMPAIGN[pl.w][pl.l + 1].id}`, true) });
    else if (pl.w + 1 < WORLDS.length && nowUnlocked) actions.push({ label: `Next: ${WORLDS[pl.w + 1].name}`, kind: 'primary', onClick: () => go(`world/${pl.w + 1}`, true) });
    else actions.push({ label: 'Campaign', kind: 'primary', onClick: () => go('campaign', true) });
    show({
      title: pickCheer(),
      html: `${stats}${!wasUnlocked && nowUnlocked ? `<p class="unlock">${icon('lock')} New world unlocked: <b>${WORLDS[pl.w + 1].name}</b></p>` : ''}`,
      actions,
      cls: 'win',
    });
  } else if (mode === 'gallery') {
    recordDone(id, res);
    const idx = GALLERY.findIndex((g) => g.id === id);
    const next = GALLERY.slice(idx + 1).concat(GALLERY.slice(0, idx)).find((g) => !db.done[g.id]);
    const title = document.querySelector('.tb-title');
    if (title) title.textContent = puzzle.title;
    show({
      title: `You painted: ${esc(puzzle.title)}`,
      html: `<div class="win-pic">${pictureMini(puzzle, puzzle.palette, 16, 1)}</div>${stats}`,
      actions: [
        { label: 'Gallery', onClick: () => go('gallery', true) },
        next ? { label: 'Next picture', kind: 'primary', onClick: () => go(`play/${next.id}`, true) } : { label: 'Done', kind: 'primary', onClick: () => go('gallery', true) },
      ],
      cls: 'win',
    });
  } else if (mode === 'daily') {
    const key = dateKey();
    if (!db.daily.history[key]) db.daily.history[key] = { t: Math.round(res.time), h: res.hints };
    recordDone(`daily-${key}`, res);
    const st = streak(db.daily.history, key);
    show({
      title: 'Daily solved!',
      html: `${stats}<p class="center">${icon('flame', 'inline')} <b>${st}</b>-day streak. Come back tomorrow for a new board.</p>`,
      actions: [
        { label: 'Home', onClick: () => go('', true) },
        { label: 'Share', kind: 'primary', close: false, onClick: () => shareDaily(key) },
      ],
      cls: 'win',
    });
  } else if (mode === 'endless') {
    const first = recordDone(`endless-${puzzle.seed}`, res);
    if (first) {
      db.endless.solved[puzzle.diff] = (db.endless.solved[puzzle.diff] || 0) + 1;
      persist();
    }
    show({
      title: pickCheer(),
      html: stats,
      actions: [
        { label: 'Settings', onClick: () => go('endless', true) },
        { label: 'Another', kind: 'primary', onClick: () => anotherEndless() },
      ],
      cls: 'win',
    });
  }
}

async function anotherEndless() {
  const p = db.endless.puzzle;
  const params = { w: p.w, h: p.h, c: p.c, diff: p.diff, nb: p.nb || 'king', sym: p.sym || null, wrap: !!p.wrap, silent: p.kind.includes('p'), mystery: p.kind.includes('m'), attempts: 6 };
  const o = endlessOpts();
  params.silent = o.silent || params.silent;
  params.mystery = o.mystery || params.mystery;
  params.seed = (Math.random() * 2 ** 31) >>> 0;
  toast('Creating a new puzzle…', { ms: 1200 });
  try {
    db.endless.puzzle = await generateAsync(params);
    persist();
    rendered = null;
    go('play/endless', true);
  } catch {
    toast('Could not create a puzzle.');
  }
}

const CHEERS = ['Solved!', 'Brilliant!', 'Nicely done!', 'Spotless!', 'Beautiful!', 'Sharp!', 'Lovely logic!'];

function pickCheer() {
  return CHEERS[Math.floor(Math.random() * CHEERS.length)];
}

applyTheme();
initPWA({
  onUpdate: () => toast('Huesweeper was updated.', { action: 'Reload', onAction: () => location.reload(), ms: 8000 }),
});
window.addEventListener('popstate', route);
window.addEventListener('hashchange', route);
route();

window.__huesweeper = { db, get game() { return game; }, VERSION, miniBoard };
