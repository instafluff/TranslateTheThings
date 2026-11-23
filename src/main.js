import './styles.css';
import { SUPPORTED_CODES, populateLanguages } from './languages.js';
import { MAX_CHARACTERS, chunkText, formatBytes } from './text.js';

const $ = (id) => document.getElementById(id);
const sourceSelect = $('source-language');
const targetSelect = $('target-language');
const sourceInput = $('source-text');
const outputElement = $('translation-output');
const translateButton = $('translate-button');
const translateLabel = $('translate-button-label');
const modelButton = $('model-button');
const modelDialog = $('model-dialog');
const MAX_MODEL_BYTES = 3111894696;

function readPreference(key, fallback) {
  try { return localStorage.getItem('ttt-' + key) || fallback; }
  catch { return fallback; }
}
function savePreference(key, value) {
  try { localStorage.setItem('ttt-' + key, value); } catch { /* storage can be disabled */ }
}
const preferredSource = readPreference('source', 'en');
const preferredTarget = readPreference('target', 'de_DE');
populateLanguages(sourceSelect, preferredSource);
populateLanguages(targetSelect, preferredTarget);
if (!SUPPORTED_CODES.has(sourceSelect.value)) sourceSelect.value = 'en';
if (!SUPPORTED_CODES.has(targetSelect.value)) targetSelect.value = 'de_DE';

const state = {
  input: '',
  output: '',
  source: sourceSelect.value,
  target: targetSelect.value,
  model: 'idle',
  gpu: 'checking',
  detail: '',
  engine: null,
  downloaded: new Map(),
  translating: false,
  revision: 0,
  pendingTranslate: false,
};
let toastTimer;
let elapsedStart = 0;

function showToast(message) {
  const node = $('toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 3400);
}

function setInlineMessage(message, kind = 'info') {
  const node = $('inline-message');
  node.hidden = !message;
  node.textContent = message;
  node.dataset.kind = kind;
}

function renderOutput() {
  outputElement.replaceChildren();
  outputElement.classList.toggle('is-empty', !state.output);
  if (state.output) {
    const paragraph = document.createElement('div');
    paragraph.className = 'output-text';
    paragraph.textContent = state.output;
    outputElement.append(paragraph);
  } else {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<div class="empty-state-icon" aria-hidden="true">✦</div><p>Your translation will appear here.</p><span>Choose languages and enter a little text to begin.</span>';
    outputElement.append(empty);
  }
  $('copy-button').disabled = !state.output;
}

function updateControls() {
  const hasText = Boolean(state.input.trim());
  const same = state.source === state.target;
  translateButton.disabled = !hasText || same || state.translating || state.model === 'loading' || state.gpu !== 'available';
  translateLabel.textContent = state.translating ? 'Translating…' : state.model === 'ready' ? 'Translate text' : 'Translate text';
  translateButton.classList.toggle('is-busy', state.translating);
  $('char-count').textContent = state.input.length.toLocaleString() + ' / ' + MAX_CHARACTERS.toLocaleString() + ' characters';
  $('char-count').classList.toggle('at-limit', state.input.length >= MAX_CHARACTERS);
  modelButton.disabled = state.model === 'loading' || state.model === 'ready' || state.gpu !== 'available';
  modelButton.textContent = state.model === 'loading' ? 'Preparing…' : state.model === 'ready' ? 'Model ready ✓' : state.model === 'failed' ? 'Try again ↗' : 'Prepare model ↗';
  const labels = { idle: 'Not loaded', loading: 'Preparing', ready: 'Ready to translate', failed: 'Needs attention' };
  $('model-state').textContent = labels[state.model];
  $('model-state').dataset.state = state.model;
  if (same) setInlineMessage('Choose two different languages to translate.', 'info');
  else if ($('inline-message').textContent === 'Choose two different languages to translate.') setInlineMessage('');
}

function invalidateResult() {
  state.revision += 1;
  state.output = '';
  renderOutput();
  $('output-meta').textContent = 'Powered by TranslateGemma 4B';
}

function updateInput(text) {
  state.input = text.slice(0, MAX_CHARACTERS);
  sourceInput.value = state.input;
  invalidateResult();
  updateControls();
}

sourceInput.addEventListener('input', () => updateInput(sourceInput.value));

sourceSelect.addEventListener('change', () => {
  state.source = sourceSelect.value;
  savePreference('source', state.source);
  invalidateResult();
  updateControls();
});
targetSelect.addEventListener('change', () => {
  state.target = targetSelect.value;
  savePreference('target', state.target);
  invalidateResult();
  updateControls();
});

$('swap-button').addEventListener('click', () => {
  const oldResult = state.output;
  const previousSource = state.source;
  state.source = state.target;
  state.target = previousSource;
  sourceSelect.value = state.source;
  targetSelect.value = state.target;
  savePreference('source', state.source);
  savePreference('target', state.target);
  // If a translation exists, use it as the new source; never label an unverified
  // reversal of the old input as a newly generated translation.
  updateInput(oldResult || state.input);
  sourceInput.focus();
});

$('clear-button').addEventListener('click', () => {
  updateInput('');
  setInlineMessage('');
  sourceInput.focus();
});

$('paste-button').addEventListener('click', async () => {
  try {
    if (!navigator.clipboard?.readText) throw new Error('not available');
    const text = await navigator.clipboard.readText();
    updateInput(text);
    sourceInput.focus();
    if (text.length > MAX_CHARACTERS) showToast('Text shortened to the 4,000-character limit.');
    else showToast('Text pasted.');
  } catch {
    showToast('Clipboard access was blocked. Paste into the text box instead.');
    sourceInput.focus();
  }
});

$('copy-button').addEventListener('click', async () => {
  if (!state.output) return;
  try {
    await navigator.clipboard.writeText(state.output);
    showToast('Translation copied to clipboard.');
  } catch {
    showToast('Unable to copy automatically. Select the translated text to copy.');
  }
});

const samples = {
  business: {
    source: 'cs_CZ', target: 'de_DE',
    text: 'Dobrý den, děkujeme za Vaši nabídku. Rádi bychom si upřesnili termín dodání a podmínky spolupráce. Můžete nám prosím zaslat aktualizovanou cenovou kalkulaci do pátku?',
  },
  product: {
    source: 'en', target: 'fr_FR',
    text: 'Crafted for everyday comfort, this lightweight jacket combines a breathable outer layer with practical details. Designed to move with you, whatever the day brings.',
  },
  travel: {
    source: 'uk_UA', target: 'pl_PL',
    text: 'Доброго дня! Наш потяг прибуває о 18:30. Чи можна буде заселитися трохи пізніше? Будемо вдячні за підтвердження.',
  },
};
document.querySelectorAll('[data-example]').forEach((button) => {
  button.addEventListener('click', () => {
    const sample = samples[button.dataset.example];
    if (!sample) return;
    state.source = sample.source;
    state.target = sample.target;
    sourceSelect.value = sample.source;
    targetSelect.value = sample.target;
    savePreference('source', sample.source);
    savePreference('target', sample.target);
    updateInput(sample.text);
    sourceInput.focus();
    showToast('Example added. Ready when you are.');
  });
});

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  savePreference('theme', theme);
  $('theme-toggle').setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  $('theme-toggle').setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  $('theme-toggle').innerHTML = theme === 'dark'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 15.5A8 8 0 0 1 8.5 5 8 8 0 1 0 19 15.5Z"/></svg>';
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = theme === 'dark' ? '#10121b' : '#f7f8fb';
}
const defaultTheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
setTheme(readPreference('theme', defaultTheme) === 'dark' ? 'dark' : 'light');
$('theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

function userFriendlyError(error) {
  const message = String(error?.message || error || 'Unknown error.');
  if (/out of memory|oom|allocation|device lost|lost device/i.test(message)) {
    return 'Your device ran out of GPU memory or the graphics device was reset. Close other GPU-heavy tabs and try reloading the page.';
  }
  if (/quota|storage|disk/i.test(message)) {
    return 'The browser could not store the model. Free up storage or clear some browser data, then retry.';
  }
  if (/fetch|network|http|failed to load/i.test(message)) {
    return 'Model download failed. Check your internet connection and browser storage, then try again.';
  }
  return 'Could not start the model: ' + message.slice(0, 220);
}

function progressUpdate(event) {
  if (state.model !== 'loading') return;
  if (event.status === 'progress' && typeof event.loaded === 'number') {
    state.downloaded.set(String(event.file || 'unknown'), event.loaded);
  }
  const downloaded = [...state.downloaded.values()].reduce((a, b) => a + b, 0);
  const pct = Math.min(99, Math.floor((downloaded / MAX_MODEL_BYTES) * 100));
  $('model-progress-bar').style.width = pct + '%';
  $('model-progress-percent').textContent = pct + '%';
  if (event.status === 'progress') {
    $('model-progress-label').textContent = formatBytes(downloaded) + ' of approximately 3.1 GB';
  } else if (event.status === 'initiate' || event.status === 'download') {
    $('model-progress-label').textContent = 'Downloading model files…';
  } else if (event.status === 'done' || event.status === 'ready') {
    $('model-progress-label').textContent = 'Preparing translation engine…';
  }
}

function updateModelStatus() {
  const description = $('model-description');
  const footnote = $('model-footnote');
  if (state.gpu === 'unavailable') {
    description.textContent = 'This browser or device does not expose WebGPU. TranslateGemma 4B cannot run here with the current engine. The interface works, but translation needs a compatible device.';
    footnote.textContent = 'Try an up-to-date GPU-enabled browser on supported hardware';
  } else if (state.gpu === 'available') {
    if (state.model === 'ready') {
      description.textContent = 'The model is loaded in this browser session. Translation runs locally, without sending text to a server.';
      footnote.textContent = 'Ready to translate · Model files may remain cached';
    } else if (state.model === 'loading') {
      description.textContent = 'Downloading and preparing a high-quality local translation engine. Please keep this tab open.';
      footnote.textContent = 'First setup is large and may take time';
    } else if (state.model === 'failed') {
      description.textContent = 'Something prevented the model from loading. Check the message below, then retry if your device has sufficient resources.';
      footnote.textContent = 'No translation data was uploaded';
    } else {
      description.textContent = 'Google’s specialized translation model runs locally. Its first download is approximately 3.1 GB, so you choose when to start.';
      footnote.textContent = 'WebGPU detected · Requires substantial device memory';
    }
  } else {
    footnote.textContent = 'Checking device compatibility…';
  }
  updateControls();
}

async function checkWebGPU() {
  try {
    if (!window.isSecureContext || !navigator.gpu?.requestAdapter) throw new Error('WebGPU unavailable');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter');
    state.gpu = 'available';
  } catch {
    state.gpu = 'unavailable';
    setInlineMessage('WebGPU is unavailable in this browser or device. The TranslateGemma 4B engine requires a compatible GPU-enabled browser.', 'error');
  }
  updateModelStatus();
}

function askToLoad(translateAfter = false) {
  if (state.model === 'loading' || state.model === 'ready' || state.gpu !== 'available') return;
  state.pendingTranslate = translateAfter;
  if (navigator.connection?.saveData) {
    $('dialog-description').textContent = 'Data Saver is on. This model is approximately 3.1 GB and requires a large download and free device memory. Start only when you are ready.';
  }
  modelDialog.showModal();
}
modelButton.addEventListener('click', () => askToLoad(false));
$('cancel-download').addEventListener('click', () => { modelDialog.close(); state.pendingTranslate = false; });
modelDialog.addEventListener('cancel', () => { state.pendingTranslate = false; });
$('confirm-download').addEventListener('click', async () => {
  modelDialog.close();
  await prepareModel();
});

async function prepareModel() {
  if (state.model === 'loading' || state.model === 'ready') return;
  state.model = 'loading';
  state.downloaded.clear();
  $('model-progress-wrap').hidden = false;
  $('model-progress-label').textContent = 'Preparing model download…';
  $('model-progress-percent').textContent = '0%';
  $('model-progress-bar').style.width = '0%';
  setInlineMessage('');
  updateModelStatus();
  try {
    // Dynamic import prevents a multi-GB model download on page visit.
    const engine = await import('./translation.js');
    await engine.loadModel(progressUpdate);
    state.engine = engine;
    state.model = 'ready';
    $('model-progress-bar').style.width = '100%';
    $('model-progress-percent').textContent = '100%';
    $('model-progress-label').textContent = 'Model ready';
    updateModelStatus();
    showToast('Your translation model is ready.');
    if (state.pendingTranslate && state.input.trim()) {
      state.pendingTranslate = false;
      await translate();
    }
  } catch (error) {
    state.model = 'failed';
    state.pendingTranslate = false;
    $('model-progress-wrap').hidden = true;
    updateModelStatus();
    setInlineMessage(userFriendlyError(error), 'error');
  }
}

async function translate() {
  if (!state.input.trim() || state.translating) return;
  if (state.source === state.target) {
    setInlineMessage('Choose two different languages to translate.', 'info');
    return;
  }
  if (state.gpu !== 'available') {
    setInlineMessage('A WebGPU-capable browser is needed for TranslateGemma 4B.', 'error');
    return;
  }
  if (state.model !== 'ready') { askToLoad(true); return; }
  const parts = chunkText(state.input);
  if (!parts.length) return;
  const revision = ++state.revision;
  state.translating = true;
  state.output = '';
  renderOutput();
  setInlineMessage('');
  elapsedStart = performance.now();
  $('output-meta').textContent = 'Translating on this device…';
  updateControls();
  try {
    const results = [];
    for (let i = 0; i < parts.length; i += 1) {
      if (revision !== state.revision) return;
      $('output-meta').textContent = 'Translating part ' + (i + 1) + ' of ' + parts.length + '…';
      const result = await state.engine.translatePart(parts[i], state.source, state.target);
      if (revision !== state.revision) return;
      results.push(result);
      state.output = results.join('\n\n');
      renderOutput();
    }
    $('output-meta').textContent = 'Translated locally in ' + ((performance.now() - elapsedStart) / 1000).toFixed(1) + 's';
  } catch (error) {
    if (revision === state.revision) {
      setInlineMessage('Translation failed. ' + userFriendlyError(error), 'error');
      $('output-meta').textContent = 'Translation interrupted';
    }
  } finally {
    state.translating = false;
    updateControls();
  }
}
translateButton.addEventListener('click', translate);
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !modelDialog.open) {
    event.preventDefault();
    translate();
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline shell is optional */ });
  });
}
window.addEventListener('offline', () => {
  if (state.model !== 'ready') showToast('You are offline. Loading uncached model files may fail.');
});

renderOutput();
updateControls();
checkWebGPU();
