import { generatePuzzle } from './generator.js';

self.onmessage = (e) => {
  const { id, opts } = e.data;
  try {
    self.postMessage({ id, puzzle: generatePuzzle(opts) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
