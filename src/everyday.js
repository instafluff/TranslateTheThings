// Promise-based messaging for the isolated everyday translation worker.
let worker;
let nextId = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./everyday.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const job = pending.get(data?.id);
    if (!job) return;
    if (data.type === 'progress') {
      job.onProgress?.(data.progress);
      return;
    }
    pending.delete(data.id);
    if (data.type === 'error') job.reject(new Error(data.message));
    else job.resolve(data.result);
  };
  worker.onerror = (error) => {
    const reason = new Error(error.message || 'Translation worker stopped.');
    for (const job of pending.values()) job.reject(reason);
    pending.clear();
    worker?.terminate();
    worker = undefined;
  };
  return worker;
}
function callWorker(type, data = {}, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      const id = ++nextId;
      pending.set(id, { resolve, reject, onProgress });
      getWorker().postMessage({ ...data, type, id });
    } catch (error) {
      pending.delete(nextId);
      reject(error);
    }
  });
}
export async function loadModel(onProgress = () => {}) {
  return callWorker('load', {}, onProgress);
}
export async function translatePart(text, source, target) {
  return callWorker('translate', { text, source, target });
}
