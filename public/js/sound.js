import { db } from './store.js';

let ctx = null;
let last = 0;

function audio() {
  if (!db.settings.sound) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, { at = 0, dur = 0.08, type = 'triangle', gain = 0.07 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const NOTES = [523.25, 659.25, 783.99, 987.77];

export const sfx = {
  paint(k) {
    const now = performance.now();
    if (now - last < 35) return;
    last = now;
    tone(NOTES[k] || 600, { dur: 0.07 });
  },
  clear() {
    tone(247, { dur: 0.06, type: 'sine', gain: 0.05 });
  },
  tap() {
    tone(880, { dur: 0.03, type: 'sine', gain: 0.03 });
  },
  hint() {
    tone(698.46, { dur: 0.09, type: 'sine', gain: 0.05 });
    tone(880, { at: 0.07, dur: 0.12, type: 'sine', gain: 0.05 });
  },
  error() {
    tone(196, { dur: 0.12, type: 'square', gain: 0.03 });
    tone(174.6, { at: 0.1, dur: 0.16, type: 'square', gain: 0.03 });
  },
  win() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, n) => tone(f, { at: n * 0.08, dur: 0.22, gain: 0.06 }));
  },
};

export function buzz(pattern = 8) {
  if (!db.settings.vibrate) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}
