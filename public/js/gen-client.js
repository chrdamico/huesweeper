let worker;
let seq = 0;
const pending = new Map();

async function local(opts) {
  const { generatePuzzle } = await import('./generator.js');
  await new Promise((r) => setTimeout(r, 20));
  return generatePuzzle(opts);
}

function getWorker() {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./gen-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const job = pending.get(e.data.id);
      if (!job) return;
      pending.delete(e.data.id);
      if (e.data.error) job.reject(new Error(e.data.error));
      else job.resolve(e.data.puzzle);
    };
    worker.onerror = () => {
      worker = null;
      for (const [id, job] of pending) {
        pending.delete(id);
        local(job.opts).then(job.resolve, job.reject);
      }
    };
  } catch {
    worker = null;
  }
  return worker;
}

export function generateAsync(opts) {
  const w = getWorker();
  if (!w) return local(opts);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, opts });
    w.postMessage({ id, opts });
  });
}
