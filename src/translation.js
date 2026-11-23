// Loaded only after explicit user consent; all model inference occurs in the browser.
// Follows the published TranslateGemma Transformers.js/WebGPU reference implementation.
import { pipeline } from '@huggingface/transformers';

export const MODEL_ID = 'onnx-community/translategemma-text-4b-it-ONNX';
export const MODEL_BYTES = 3111894696;
let translatorPromise;

export async function loadModel(onProgress = () => {}) {
  if (!translatorPromise) {
    translatorPromise = pipeline('text-generation', MODEL_ID, {
      device: 'webgpu',
      dtype: 'q4',
      progress_callback: onProgress,
    }).catch((error) => {
      translatorPromise = undefined;
      throw error;
    });
  }
  return translatorPromise;
}

export async function translatePart(text, source, target) {
  if (!translatorPromise) throw new Error('Model has not been prepared.');
  const translator = await translatorPromise;
  // The model's official template requires exactly one structured user content item.
  const messages = [{ role: 'user', content: [{
    type: 'text', source_lang_code: source, target_lang_code: target, text,
  }] }];
  const output = await translator(messages, {
    max_new_tokens: 1024,
    do_sample: false,
  });
  const generated = output?.[0]?.generated_text;
  if (Array.isArray(generated)) {
    const answer = generated[generated.length - 1]?.content;
    if (typeof answer === 'string') return answer.trim();
  }
  if (typeof generated === 'string') return generated.trim();
  throw new Error('The model returned an unexpected response.');
}
