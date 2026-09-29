import { prepare, isEditable, hasClue } from './board.js';
import { hashString } from './rng.js';
import { buildModel } from './solver.js';
import { findHint, hintSources, hintText } from './hint.js';
import { applyPalette } from './palettes.js';
import { sfx, buzz } from './sound.js';
import { icon } from './icons.js';
import { RULE_INFO, rulesOf } from './rules-info.js';

const LONG_PRESS = 420;

export function swatch(k) {
  return `<span class="sw" data-c="${k}"><i class="sym"></i></span>`;
}

export class Game {
  constructor(puzzle, opts) {
    this.p = puzzle;
    this.opts = opts;
    this.prep = prepare(puzzle);
    this.kind = puzzle.kind;
    this.model = buildModel(this.prep, puzzle.kind);
    const { N, sol } = this.prep;
    this.N = N;
    this.board = new Int8Array(N).fill(-1);
    this.notes = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (!isEditable(this.kind[i])) this.board[i] = sol[i];
    this.sig = hashString(puzzle.sol + puzzle.kind).toString(36);
    const saved = opts.saved && (!opts.saved.s || opts.saved.s === this.sig) ? opts.saved : null;
    if (saved && saved.b && saved.b.length === N) {
      for (let i = 0; i < N; i++) {
        if (!isEditable(this.kind[i])) continue;
        const ch = saved.b[i];
        this.board[i] = ch >= '0' && ch <= '9' ? Math.min(+ch, puzzle.c - 1) : -1;
        if (saved.n) this.notes[i] = parseInt(saved.n[i] || '0', 16) || 0;
      }
    }
    this.hints = saved?.h || 0;
    this.elapsed = saved?.t || 0;
    this.t0 = null;
    this.hist = [];
    this.fut = [];
    this.tool = 0;
    this.notesMode = false;
    this.solved = false;
    this.focus = -1;
    this.hint = null;
    this.stroke = null;
    this.pressTimer = 0;
    this.msgDefault = opts.tip || '';
    this.onVis = () => (document.visibilityState === 'visible' ? this.resume() : this.pause());
  }

  mount(root) {
    this.root = root;
    root.classList.add('game');
    applyPalette(root, this.opts.colors);
    const rules = rulesOf(this.p);
    root.innerHTML = `
      <div class="chips">${rules
        .map((r) => `<button class="chip" data-rule="${r}">${RULE_INFO[r].label}${icon('info', 'chip-i')}</button>`)
        .join('')}</div>
      <div class="board-wrap"><div class="board" role="grid" aria-label="Puzzle board"></div></div>
      <div class="msg" aria-live="polite"></div>
      <div class="palette" role="toolbar" aria-label="Colours"></div>
      <div class="toolbar">
        <button class="tb" data-act="undo" aria-label="Undo">${icon('undo')}<span>Undo</span></button>
        <button class="tb" data-act="redo" aria-label="Redo">${icon('redo')}<span>Redo</span></button>
        <button class="tb" data-act="notes" aria-label="Notes" aria-pressed="false">${icon('pencil')}<span>Notes</span></button>
        <button class="tb" data-act="hint" aria-label="Hint">${icon('bulb')}<span>Hint</span></button>
        <button class="tb" data-act="restart" aria-label="Restart">${icon('restart')}<span>Restart</span></button>
      </div>`;
    this.wrapEl = root.querySelector('.board-wrap');
    this.boardEl = root.querySelector('.board');
    this.msgEl = root.querySelector('.msg');
    this.palEl = root.querySelector('.palette');
    this.buildBoard();
    this.buildPalette();
    root.querySelector('.chips').addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (b) this.opts.onRule?.(b.dataset.rule);
    });
    root.querySelector('.toolbar').addEventListener('click', (e) => {
      const b = e.target.closest('.tb');
      if (!b || b.disabled) return;
      const a = b.dataset.act;
      if (a === 'undo') this.undo();
      else if (a === 'redo') this.redo();
      else if (a === 'notes') this.setNotes(!this.notesMode);
      else if (a === 'hint') this.showHint();
      else if (a === 'restart') this.opts.onRestart?.();
    });
    this.layout();
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.wrapEl);
    this.onKey = (e) => this.key(e);
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onVis);
    this.refreshAll();
    if (this.isComplete() && this.isCorrect()) {
      this.solved = true;
      this.boardEl.classList.add('won', 'reveal');
    } else this.resume();
    this.idle(true);
    this.updateTools();
  }

  left() {
    let n = 0;
    for (let i = 0; i < this.N; i++) if (this.board[i] < 0) n++;
    return n;
  }

  idle(force = false) {
    if (!force && this.msgKind === 'hint') return;
    if (this.solved) {
      this.setMsg('Solved. Tap <b>Restart</b> to play it again.', 'done');
      return;
    }
    if (this.msgDefault) {
      this.setMsg(`${icon('info', 'msg-i tip-i')}<span>${this.msgDefault}</span>`, 'tip');
      return;
    }
    const n = this.left();
    this.setMsg(`${n} cell${n === 1 ? '' : 's'} left`);
  }

  destroy() {
    this.dead = true;
    this.pause();
    this.ro?.disconnect();
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVis);
    clearTimeout(this.pressTimer);
  }

  resume() {
    if (this.solved || this.t0 != null) return;
    this.t0 = performance.now();
  }

  pause() {
    if (this.t0 == null) return;
    this.elapsed += performance.now() - this.t0;
    this.t0 = null;
  }

  time() {
    return this.elapsed + (this.t0 != null ? performance.now() - this.t0 : 0);
  }

  buildBoard() {
    const { w, h } = this.p;
    const b = this.boardEl;
    b.style.setProperty('--w', w);
    b.style.setProperty('--h', h);
    if (this.p.wrap) b.classList.add('wrap');
    if (this.p.nb && this.p.nb !== 'king') b.classList.add(`nb-${this.p.nb}`);
    if (this.p.c > 2) b.classList.add('multi');
    const frag = document.createDocumentFragment();
    this.cells = [];
    for (let i = 0; i < this.N; i++) {
      const el = document.createElement('div');
      el.dataset.i = i;
      el.innerHTML = '<div class="tile"></div><i class="sym"></i><span class="num"></span><span class="notes"><i></i><i></i><i></i><i></i></span>';
      this.cells.push(el);
      frag.appendChild(el);
    }
    b.appendChild(frag);
    if (this.p.sym) {
      const s = document.createElement('div');
      s.className = `sym-guide sym-${this.p.sym}`;
      b.appendChild(s);
    }
    b.addEventListener('pointerdown', (e) => this.down(e));
    this.wrapEl.addEventListener('pointerdown', (e) => {
      if (this.focus >= 0 && !e.target.closest('.cell')) this.setFocus(-1);
    });
    b.addEventListener('pointermove', (e) => this.move(e));
    b.addEventListener('pointerup', (e) => this.up(e));
    b.addEventListener('pointercancel', (e) => this.up(e, true));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  buildPalette() {
    const c = this.p.c;
    let html = '';
    for (let k = 0; k < c; k++) {
      html += `<button class="swatch" data-tool="${k}" data-c="${k}" aria-label="Colour ${k + 1}"><i class="sym"></i><kbd>${k + 1}</kbd></button>`;
    }
    html += `<button class="swatch eraser" data-tool="erase" aria-label="Eraser">${icon('eraser')}</button>`;
    this.palEl.innerHTML = html;
    this.palEl.addEventListener('click', (e) => {
      const b = e.target.closest('.swatch');
      if (!b) return;
      this.setTool(b.dataset.tool === 'erase' ? 'erase' : +b.dataset.tool);
      sfx.tap();
    });
    this.setTool(0);
  }

  setTool(t) {
    this.tool = t;
    for (const b of this.palEl.children) b.classList.toggle('sel', b.dataset.tool === String(t));
  }

  setNotes(on) {
    this.notesMode = on;
    this.root.classList.toggle('notes-mode', on);
    const b = this.root.querySelector('[data-act="notes"]');
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    if (on && this.tool === 'erase') this.setTool(0);
  }

  layout() {
    const { w, h } = this.p;
    const r = this.wrapEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const pad = this.p.wrap ? 14 : 4;
    let gap = 4;
    let cell = Math.floor(Math.min((r.width - pad * 2 - gap * (w - 1)) / w, (r.height - pad * 2 - gap * (h - 1)) / h));
    if (cell < 34) {
      gap = 3;
      cell = Math.floor(Math.min((r.width - pad * 2 - gap * (w - 1)) / w, (r.height - pad * 2 - gap * (h - 1)) / h));
    }
    cell = Math.max(16, Math.min(cell, 72));
    this.boardEl.style.setProperty('--cell', `${cell}px`);
    this.boardEl.style.setProperty('--gap', `${gap}px`);
  }

  cellAt(x, y) {
    const el = document.elementFromPoint(x, y)?.closest?.('.cell');
    if (!el || el.parentNode !== this.boardEl) return -1;
    return +el.dataset.i;
  }

  down(e) {
    if (this.solved || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const i = this.cellAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    if (this.stroke) {
      const prev = this.stroke;
      clearTimeout(this.pressTimer);
      this.stroke = null;
      this.commit(prev.ch);
      if (this.solved) return;
    }
    try {
      this.boardEl.setPointerCapture(e.pointerId);
    } catch {}
    const k = this.kind[i];
    if (!isEditable(k)) {
      this.stroke = null;
      if (hasClue(k)) this.setFocus(this.focus === i ? -1 : i);
      else this.setFocus(-1);
      sfx.tap();
      return;
    }
    this.stroke = { pid: e.pointerId, act: this.actionFor(i), ch: [], seen: new Set([i]), first: i, pending: k === 'm' };
    if (this.stroke.pending) {
      clearTimeout(this.pressTimer);
      this.pressTimer = setTimeout(() => {
        if (this.stroke && this.stroke.pending) {
          this.stroke = null;
          this.setFocus(this.focus === i ? -1 : i);
          buzz(12);
        }
      }, LONG_PRESS);
    } else {
      this.apply(i, this.stroke.act);
    }
  }

  move(e) {
    const s = this.stroke;
    if (!s || s.pid !== e.pointerId) return;
    const i = this.cellAt(e.clientX, e.clientY);
    if (i < 0 || s.seen.has(i)) return;
    if (s.pending) {
      s.pending = false;
      clearTimeout(this.pressTimer);
      this.apply(s.first, s.act);
    }
    s.seen.add(i);
    this.apply(i, s.act);
  }

  up(e, cancel = false) {
    const s = this.stroke;
    if (!s || s.pid !== e.pointerId) return;
    clearTimeout(this.pressTimer);
    if (s.pending && !cancel) this.apply(s.first, s.act);
    this.stroke = null;
    this.commit(s.ch);
  }

  actionFor(i) {
    const v = this.board[i];
    if (this.opts.settings.cycle && !this.notesMode && this.tool !== 'erase') {
      const next = v + 1 >= this.p.c ? -1 : v + 1;
      return { type: 'set', v: next, only: null };
    }
    if (this.tool === 'erase') {
      if (v >= 0) return { type: 'set', v: -1, only: null };
      return { type: 'wipe' };
    }
    if (this.notesMode) {
      const bit = 1 << this.tool;
      return { type: 'note', bit, on: !(this.notes[i] & bit) };
    }
    if (v === this.tool) return { type: 'set', v: -1, only: this.tool };
    return { type: 'set', v: this.tool, only: null };
  }

  apply(i, act, ch = this.stroke?.ch) {
    if (!isEditable(this.kind[i])) return;
    const ov = this.board[i];
    const on = this.notes[i];
    let nv = ov;
    let nn = on;
    if (act.type === 'set') {
      if (act.only != null && ov !== act.only) return;
      nv = act.v;
    } else if (act.type === 'note') {
      if (ov >= 0) return;
      nn = act.on ? on | act.bit : on & ~act.bit;
    } else if (act.type === 'wipe') {
      if (ov >= 0) return;
      nn = 0;
    }
    if (nv === ov && nn === on) return;
    this.board[i] = nv;
    this.notes[i] = nn;
    ch?.push([i, ov, nv, on, nn]);
    this.updateCell(i);
    if (nv !== ov) {
      this.pop(i);
      if (nv >= 0) sfx.paint(nv);
      else sfx.clear();
      buzz(6);
    }
    if (this.hint) this.clearHint();
    this.refreshClues();
    if (this.msgKind !== 'tip') this.idle();
  }

  commit(ch) {
    if (!ch.length) return;
    this.hist.push(ch);
    if (this.hist.length > 400) this.hist.shift();
    this.fut = [];
    this.releaseFocus(ch);
    this.afterChange();
  }

  releaseFocus(ch) {
    const f = this.focus;
    if (f < 0) return;
    const nbs = this.prep.nbs[f];
    const inside = new Set(nbs);
    inside.add(f);
    const strayed = ch.some(([i]) => !inside.has(i));
    const done = nbs.every((j) => this.board[j] >= 0);
    if (strayed || done) this.setFocus(-1);
  }

  afterChange() {
    this.updateTools();
    this.save();
    this.checkDone();
  }

  undo() {
    const ch = this.hist.pop();
    if (!ch || this.solved) {
      if (ch) this.hist.push(ch);
      return;
    }
    for (let t = ch.length - 1; t >= 0; t--) {
      const [i, ov, , on] = ch[t];
      this.board[i] = ov;
      this.notes[i] = on;
      this.updateCell(i);
      this.pop(i);
    }
    this.fut.push(ch);
    sfx.clear();
    this.clearHint();
    this.refreshClues();
    this.idle();
    this.updateTools();
    this.save();
  }

  redo() {
    const ch = this.fut.pop();
    if (!ch || this.solved) return;
    for (const [i, , nv, , nn] of ch) {
      this.board[i] = nv;
      this.notes[i] = nn;
      this.updateCell(i);
      this.pop(i);
    }
    this.hist.push(ch);
    sfx.tap();
    this.clearHint();
    this.refreshClues();
    this.idle();
    this.afterChange();
  }

  restart() {
    const wasSolved = this.solved;
    if (this.solved) {
      this.solved = false;
      this.boardEl.classList.remove('won', 'reveal');
      this.elapsed = 0;
      this.hints = 0;
      this.t0 = null;
      this.hist = [];
      this.resume();
    }
    const ch = [];
    for (let i = 0; i < this.N; i++) {
      if (!isEditable(this.kind[i])) continue;
      if (this.board[i] >= 0 || this.notes[i]) ch.push([i, this.board[i], -1, this.notes[i], 0]);
      this.board[i] = -1;
      this.notes[i] = 0;
    }
    if (ch.length && !wasSolved) this.hist.push(ch);
    this.fut = [];
    this.clearHint();
    this.setFocus(-1);
    this.refreshAll();
    this.updateTools();
    this.save();
    this.idle(true);
  }

  pop(i) {
    const el = this.cells[i];
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  updateCell(i) {
    const el = this.cells[i];
    const k = this.kind[i];
    const v = this.board[i];
    let cls = 'cell';
    if (k === '.') cls += ' blank player';
    else if (k === 'g') cls += ' given clue';
    else if (k === 'p') cls += ' given plain';
    else cls += ' mystery clue player';
    if (v >= 0) cls += ' has-color';
    if (el._st) cls += ` ${el._st}`;
    if (i === this.focus) cls += ' focus-src';
    else if (el._nb) cls += ' nb';
    if (el._hint) cls += ` ${el._hint}`;
    el.className = cls;
    if (v >= 0) el.dataset.c = v;
    else delete el.dataset.c;
    const num = el.children[2];
    const txt = hasClue(k) ? String(this.prep.nums[i]) : '';
    if (num.textContent !== txt) num.textContent = txt;
    const nn = v >= 0 ? 0 : this.notes[i];
    const dots = el.children[3].children;
    for (let b = 0; b < 4; b++) dots[b].className = nn & (1 << b) ? `on d${b}` : '';
  }

  refreshAll() {
    for (let i = 0; i < this.N; i++) this.updateCell(i);
    this.refreshClues();
  }

  clueState(i) {
    const col = this.board[i];
    if (col < 0) return '';
    const n = this.prep.nums[i];
    let same = 0;
    let open = 0;
    for (const j of this.prep.nbs[i]) {
      const v = this.board[j];
      if (v === col) same++;
      else if (v < 0) open++;
    }
    if (same > n || same + open < n) return 'err';
    if (open === 0) return 'ok';
    return '';
  }

  refreshClues() {
    const showErr = this.opts.settings.errors;
    for (let i = 0; i < this.N; i++) {
      if (!hasClue(this.kind[i])) continue;
      let st = this.clueState(i);
      if (st === 'err' && !showErr) st = '';
      const el = this.cells[i];
      if (el._st !== st) {
        el._st = st;
        this.updateCell(i);
      }
    }
  }

  setFocus(i) {
    const prev = this.focus;
    this.focus = i;
    const set = new Set(i >= 0 ? this.prep.nbs[i] : []);
    this.boardEl.classList.toggle('focusing', i >= 0);
    for (let j = 0; j < this.N; j++) {
      const was = this.cells[j]._nb;
      const now = set.has(j);
      if (was !== now || j === i || j === prev) {
        this.cells[j]._nb = now;
        this.updateCell(j);
      }
    }
  }

  isComplete() {
    for (let i = 0; i < this.N; i++) if (this.board[i] < 0) return false;
    return true;
  }

  isCorrect() {
    const sol = this.prep.sol;
    for (let i = 0; i < this.N; i++) if (this.board[i] !== sol[i]) return false;
    return true;
  }

  checkDone() {
    if (this.solved || !this.isComplete()) return;
    if (this.isCorrect()) {
      this.win();
      return;
    }
    sfx.error();
    buzz([20, 40, 20]);
    this.boardEl.classList.remove('shake');
    void this.boardEl.offsetWidth;
    this.boardEl.classList.add('shake');
    this.setMsg(
      this.opts.settings.errors
        ? 'Not quite. Some numbers don’t add up yet; look for the red ones.'
        : 'Not quite. Something doesn’t add up yet.',
      'warn',
    );
  }

  win() {
    this.solved = true;
    this.pause();
    this.setFocus(-1);
    this.clearHint();
    const { w } = this.p;
    const lastCh = this.hist[this.hist.length - 1];
    const last = lastCh && lastCh.length ? lastCh[lastCh.length - 1][0] : 0;
    const lx = last % w;
    const ly = (last / w) | 0;
    for (let i = 0; i < this.N; i++) {
      const d = Math.hypot((i % w) - lx, ((i / w) | 0) - ly);
      this.cells[i].style.setProperty('--d', `${Math.round(d * 45)}ms`);
    }
    this.boardEl.classList.add('won');
    sfx.win();
    buzz([15, 60, 15, 60, 30]);
    this.setMsg('');
    this.updateTools();
    this.save();
    const res = { time: this.time(), hints: this.hints };
    setTimeout(() => {
      if (this.dead) return;
      this.boardEl.classList.add('reveal');
      this.idle(true);
    }, 650);
    this.opts.onWin?.(res);
  }

  demoFocus() {
    const h = findHint(this.model, this.prep, this.board);
    const src = h && h.type !== 'wrong' ? hintSources(h)[0] : -1;
    if (src >= 0 && this.kind[src] === 'g') this.setFocus(src);
  }

  showHint() {
    if (this.solved) return;
    if (this.hint && this.hint.type !== 'wrong' && this.board[this.hint.cell] < 0) {
      const h = this.hint;
      const ch = [];
      this.clearHint();
      this.apply(h.cell, { type: 'set', v: h.color, only: null }, ch);
      this.commit(ch);
      return;
    }
    const h = findHint(this.model, this.prep, this.board);
    if (!h) return;
    this.hints++;
    this.hint = h;
    const srcs = h.type === 'wrong' ? [] : hintSources(h);
    this.hintCells = [h.cell, ...srcs];
    this.cells[h.cell]._hint = h.type === 'wrong' ? 'hint-wrong' : 'hint-target';
    this.cells[h.cell].style.setProperty('--hc', `var(--c${h.color ?? 0})`);
    for (const s of srcs) if (s !== h.cell) this.cells[s]._hint = 'hint-src';
    for (const j of this.hintCells) this.updateCell(j);
    const text = hintText(h, this.prep, swatch);
    this.setMsg(`${icon('bulb', 'msg-i')}<span>${text}${h.type === 'wrong' ? '' : ' <em>Tap Hint again to fill it.</em>'}</span>`, 'hint');
    sfx.hint();
    this.save();
  }

  clearHint() {
    if (!this.hint) return;
    this.hint = null;
    for (const j of this.hintCells || []) {
      this.cells[j]._hint = '';
      this.updateCell(j);
    }
    this.hintCells = [];
    this.msgKind = '';
    this.idle(true);
  }

  setMsg(html, kind = '') {
    this.msgKind = kind;
    this.msgEl.className = `msg ${kind}`;
    this.msgEl.innerHTML = html || '';
  }

  updateTools() {
    const q = (a) => this.root.querySelector(`[data-act="${a}"]`);
    q('undo').disabled = !this.hist.length || this.solved;
    q('redo').disabled = !this.fut.length || this.solved;
    q('hint').disabled = this.solved;
  }

  key(e) {
    if (e.target.closest?.('input, select, textarea') || document.querySelector('.sheet.open')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k >= '1' && k <= String(this.p.c)) this.setTool(+k - 1);
    else if (k === '0' || k === 'e') this.setTool('erase');
    else if (k === 'n') this.setNotes(!this.notesMode);
    else if (k === 'h') this.showHint();
    else if (k === 'z') this.undo();
    else if (k === 'y') this.redo();
    else return;
    e.preventDefault();
  }

  serialize() {
    let b = '';
    let n = '';
    for (let i = 0; i < this.N; i++) {
      const ed = isEditable(this.kind[i]);
      b += ed ? (this.board[i] < 0 ? '-' : String(this.board[i])) : '.';
      n += this.notes[i].toString(16);
    }
    return { b, n, t: Math.round(this.time()), h: this.hints, s: this.sig };
  }

  save() {
    this.opts.onSave?.(this.serialize(), this.solved);
  }
}
