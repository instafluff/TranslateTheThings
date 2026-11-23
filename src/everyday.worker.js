// Dedicated worker prevents CPU/WASM inference from freezing the UI.
// No network requests carry user text: only static model files are fetched.
import { pipeline } from '@huggingface/transformers';

let translatorPromise;
async function ensureModel(onProgress) {
  if (!translatorPromise) {
    translatorPromise = pipeline('translation', 'Xenova/nllb-200-distilled-600M', {
      device: 'wasm',
      dtype: 'q8',
      progress_callback: onProgress,
    }).catch((error) => { translatorPromise = undefined; throw error; });
  }
  return translatorPromise;
}
self.onmessage = async (event) => {
  const { id, type, text, source, target } = event.data || {};
  try {
    if (type === 'load') {
      await ensureModel((progress) => self.postMessage({ id, type: 'progress', progress }));
      self.postMessage({ id, type: 'result', result: 'ready' });
      return;
    }
    if (type === 'translate') {
      if (!translatorPromise) throw new Error('Model has not been loaded.');
      const translator = await translatorPromise;
      const output = await translator(text, {
        src_lang: source,
        tgt_lang: target,
        max_new_tokens: 512,
        num_beams: 2,
      });
      const translated = output?.[0]?.translation_text;
      if (typeof translated !== 'string') throw new Error('Unexpected translation output.');
      self.postMessage({ id, type: 'result', result: translated.trim() });
      return;
    }
    throw new Error('Unsupported worker request.');
  } catch (error) {
    self.postMessage({ id, type: 'error', message: String(error?.message || error) });
  }
};
