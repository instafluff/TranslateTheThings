import { SUPPORTED_CODES, populateLanguages } from './languages.js';
import { MODES, NLLB_CODES, supportedByMode } from './models.js';
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
const guideDialog = $('guide-dialog');

function readPreference(key, fallback) {
  try { return localStorage.getItem('ttt-' + key) || fallback; }
  catch { return fallback; }
}
function savePreference(key, value) {
  try { localStorage.setItem('ttt-' + key, value); } catch { /* storage can be disabled */ }
}
const preferredSource = readPreference('source', 'en');
const preferredTarget = readPreference('target', 'de_DE');
const initialMode = readPreference('mode', 'everyday') === 'premium' ? 'premium' : 'everyday';
const initialSupport = (code) => supportedByMode(code, initialMode);
populateLanguages(sourceSelect, preferredSource, initialSupport);
populateLanguages(targetSelect, preferredTarget, initialSupport);
if (!SUPPORTED_CODES.has(sourceSelect.value)) sourceSelect.value = 'en';
if (!SUPPORTED_CODES.has(targetSelect.value)) targetSelect.value = 'de_DE';

const state = {
  input: '',
  output: '',
  mode: initialMode,
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
// Keep completed downloads loaded when switching between models.
const savedSessions = {
  everyday: { model: 'idle', engine: null, downloaded: new Map() },
  premium: { model: 'idle', engine: null, downloaded: new Map() },
};
function canRunEngine() {
  return !MODES[state.mode].requiresWebGPU || state.gpu === 'available';
}

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
  outputElement.classList.toggle('is-empty', !state.output);
  outputElement.lang = state.output ? state.target.replace('_', '-') : 'en';
  outputElement.dir = 'auto';
  const content = state.output || 'Your translation appears here…';
  if (outputElement.textContent !== content) outputElement.textContent = content;
  $('copy-button').disabled = !state.output;
}

function syncLanguageLabels() {
  for (const [side, select] of [['source', sourceSelect], ['target', targetSelect]]) {
    $(side + '-code').textContent = select.value.split('_')[0].toUpperCase();
    $(side + '-name').textContent = select.selectedOptions[0].textContent;
  }
  sourceInput.lang = state.source.replace('_', '-');
}

function updateControls() {
  const hasText = Boolean(state.input.trim());
  const same = state.source === state.target;
  const locked = state.translating || state.model === 'loading';
  translateButton.disabled = !hasText || same || locked || !canRunEngine();
  translateLabel.textContent = state.translating ? 'Translating…' : state.model === 'loading' ? 'Preparing…' : 'Translate';
  $('char-count').textContent = state.input.length.toLocaleString() + ' / ' + MAX_CHARACTERS.toLocaleString();
  $('char-count').classList.toggle('at-limit', state.input.length >= MAX_CHARACTERS);
  $('clear-button').hidden = !state.input;
  modelButton.disabled = locked || state.model === 'ready' || !canRunEngine();
  modelButton.textContent = state.model === 'loading' ? 'Preparing…' : state.model === 'ready' ? 'Model ready' : state.model === 'failed' ? 'Try again' : 'Prepare model';
  const labels = { idle: 'Not loaded', loading: 'Preparing', ready: 'Ready to translate', failed: 'Needs attention' };
  $('model-state').textContent = labels[state.model];
  $('model-state').dataset.state = state.model;
  for (const mode of Object.keys(MODES)) {
    const button = $('mode-' + mode);
    button.setAttribute('aria-pressed', String(state.mode === mode));
    button.disabled = locked;
  }
  if (same) setInlineMessage('Choose two different languages to translate.', 'info');
  else if ($('inline-message').textContent === 'Choose two different languages to translate.') setInlineMessage('');
}
function switchMode(next) {
  if (!MODES[next] || next === state.mode || state.translating || state.model === 'loading') return;
  savedSessions[state.mode] = { model: state.model, engine: state.engine, downloaded: state.downloaded };
  state.mode = next;
  const saved = savedSessions[next];
  state.model = saved.model;
  state.engine = saved.engine;
  state.downloaded = saved.downloaded;
  const allows = (code) => supportedByMode(code, next);
  populateLanguages(sourceSelect, state.source, allows);
  populateLanguages(targetSelect, state.target, allows);
  state.source = supportedByMode(state.source, next) ? state.source : 'en';
  state.target = supportedByMode(state.target, next) ? state.target : 'de_DE';
  if (state.source === state.target) state.target = state.source === 'de_DE' ? 'en' : 'de_DE';
  sourceSelect.value = state.source;
  targetSelect.value = state.target;
  savePreference('source', state.source);
  savePreference('target', state.target);
  savePreference('mode', next);
  invalidateResult();
  setInlineMessage('');
  state.pendingTranslate = false;
  syncLanguageLabels();
  updateModelStatus();
}
$('mode-everyday').addEventListener('click', () => switchMode('everyday'));
$('mode-premium').addEventListener('click', () => switchMode('premium'));

function invalidateResult() {
  state.revision += 1;
  state.output = '';
  renderOutput();
  $('output-meta').textContent = '';
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
  syncLanguageLabels();
  invalidateResult();
  updateControls();
});
targetSelect.addEventListener('change', () => {
  state.target = targetSelect.value;
  savePreference('target', state.target);
  syncLanguageLabels();
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
  syncLanguageLabels();
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
    syncLanguageLabels();
    updateInput(sample.text);
    sourceInput.focus();
    showToast('Sample added to the editor.');
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
  if (metaTheme) metaTheme.content = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
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
  const spec = MODES[state.mode];
  const pct = Math.min(99, Math.floor((downloaded / spec.approximateBytes) * 100));
  $('model-progress-bar').value = pct;
  $('model-progress-percent').textContent = pct + '%';
  if (event.status === 'progress') {
    $('model-progress-label').textContent = formatBytes(downloaded) + ' of approximately ' + spec.sizeLabel;
  } else if (event.status === 'initiate' || event.status === 'download') {
    $('model-progress-label').textContent = 'Downloading model files…';
  } else if (event.status === 'done' || event.status === 'ready') {
    $('model-progress-label').textContent = 'Preparing translation engine…';
  }
}

function updateModelStatus() {
  const spec = MODES[state.mode];
  $('model-name').textContent = spec.name;
  $('model-version').textContent = spec.variant;
  $('model-link').href = spec.modelUrl;
  $('active-mode').textContent = state.mode === 'everyday' ? 'Everyday model' : 'Premium model';
  $('model-progress-wrap').hidden = state.model !== 'loading';
  const description = $('model-description');
  const summary = $('engine-summary');
  if (!canRunEngine()) {
    description.textContent = state.gpu === 'checking' ? 'Checking whether this browser supports WebGPU.' : 'Premium requires WebGPU, which is not available in this browser. Choose Everyday to translate without it.';
    summary.textContent = state.gpu === 'checking' ? 'Checking WebGPU…' : 'No WebGPU · choose Everyday';
  } else if (state.model === 'ready') {
    description.textContent = spec.name + ' is loaded in this browser session. Translation runs locally; model files may remain cached.';
    summary.textContent = 'Ready on this device';
  } else if (state.model === 'loading') {
    description.textContent = 'Downloading and preparing ' + spec.name + '. Keep this tab open until loading finishes.';
    summary.textContent = 'Preparing · keep this tab open';
  } else if (state.model === 'failed') {
    description.textContent = 'The model could not be loaded on this device. Review the error and retry if sufficient storage and memory are available.';
    summary.textContent = 'Setup failed · try again';
  } else {
    description.textContent = spec.introduction;
    summary.textContent = 'First download · ' + spec.sizeLabel;
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
    if (state.mode === 'premium') setInlineMessage('Premium requires a WebGPU-capable browser. Choose Everyday to translate using WebAssembly.', 'error');
  }
  updateModelStatus();
}

function askToLoad(translateAfter = false) {
  if (state.model === 'loading' || state.model === 'ready' || !canRunEngine()) return;
  state.pendingTranslate = translateAfter;
  const spec = MODES[state.mode];
  const dialog = $('dialog-description');
  dialog.replaceChildren(
    document.createTextNode(spec.name + ' needs a first download of '),
    Object.assign(document.createElement('strong'), { textContent: spec.sizeLabel }),
    document.createTextNode('. Your browser can reuse the files while they’re cached. Your text stays on this device.')
  );
  $('dialog-requirements').textContent = spec.requiresWebGPU
    ? 'Requires WebGPU, free storage, and substantial device memory.'
    : 'Requires free storage and memory. No WebGPU needed.';
  if (navigator.connection?.saveData) {
    dialog.append(document.createTextNode(' Data Saver is enabled; consider Wi-Fi before downloading.'));
  }
  $('dialog-license').textContent = state.mode === 'everyday'
    ? 'NLLB is CC BY-NC 4.0 (noncommercial); business use may require additional rights. Model files are downloaded from Hugging Face.'
    : 'TranslateGemma follows the Google Gemma terms. Model files are downloaded from Hugging Face; the file host may see your IP address.';
  modelDialog.showModal();
}

modelButton.addEventListener('click', () => askToLoad(false));
document.querySelectorAll('[data-open-guide]').forEach((button) => {
  button.addEventListener('click', () => guideDialog.showModal());
});
$('cancel-download').addEventListener('click', () => { modelDialog.close(); state.pendingTranslate = false; });
modelDialog.addEventListener('cancel', () => { state.pendingTranslate = false; });
$('confirm-download').addEventListener('click', async () => {
  modelDialog.close();
  if (guideDialog.open) guideDialog.close();
  await prepareModel();
});

async function prepareModel() {
  if (state.model === 'loading' || state.model === 'ready') return;
  state.model = 'loading';
  state.downloaded.clear();
  $('model-progress-label').textContent = 'Preparing model download…';
  $('model-progress-percent').textContent = '0%';
  $('model-progress-bar').value = 0;
  setInlineMessage('');
  updateModelStatus();
  try {
    // Dynamic import prevents a multi-GB model download on page visit.
    const engine = state.mode === 'everyday'
      ? await import('./everyday.js')
      : await import('./translation.js');
    await engine.loadModel(progressUpdate);
    state.engine = engine;
    state.model = 'ready';
    updateModelStatus();
    showToast('Your translation model is ready.');
    if (state.pendingTranslate && state.input.trim()) {
      state.pendingTranslate = false;
      await translate();
    }
  } catch (error) {
    state.model = 'failed';
    state.pendingTranslate = false;
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
  if (!canRunEngine()) {
    setInlineMessage('Premium requires WebGPU. Switch to Everyday to translate without it.', 'error');
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
      const sourceCode = state.mode === 'everyday' ? NLLB_CODES[state.source] : state.source;
      const targetCode = state.mode === 'everyday' ? NLLB_CODES[state.target] : state.target;
      const result = await state.engine.translatePart(parts[i], sourceCode, targetCode);
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
  if (event.key === 'Escape' && (modelDialog.open || guideDialog.open)) {
    event.preventDefault();
    if (modelDialog.open) {
      state.pendingTranslate = false;
      modelDialog.close();
    } else {
      guideDialog.close();
    }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !modelDialog.open && !guideDialog.open) {
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

$('shortcut').textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ ↵' : 'Ctrl ↵';
syncLanguageLabels();
renderOutput();
updateModelStatus();
checkWebGPU();
