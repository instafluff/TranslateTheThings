# TranslateTheThings

**Thoughtful translations, made privately in your browser.**

TranslateTheThings is a static, mobile-responsive translation app using Google's **TranslateGemma 4B** model with **Transformers.js + WebGPU**. The model runs on the visitor's own device; there is no translation API, backend compute, account or server-side inference.

> **Status:** first working implementation / hardware validation needed. The frontend and integration have been built, but actual 4B inference has not been benchmarked on your target devices yet. On phones and GPUs with limited memory, the model may fail to load; the app reports that rather than inventing results.

## Features

- A polished two-pane desktop translator and a stacked, touch-friendly mobile layout
- English, German, French, Spanish, Czech, Ukrainian, Polish, Dutch, Italian, Portuguese and many other model-supported languages
- TranslateGemma's **official structured prompt** (correct source/target tags), with deterministic generation
- Intentional model download: **about 3.1 GB** in q4 form, only after user confirmation
- Model-load progress and actionable error states, without fake sample translations
- Automatic splitting of long text into moderate-size segments; a 4,000-character input limit
- Swap languages, clipboard copy/paste, clear, keyboard shortcut (**Ctrl/Cmd + Enter**) and example inputs
- Responsive light and dark themes, local-only saved preferences
- Best-effort offline app-shell support with a versioned service worker and a static build manifest
- No analytics; input text and translations are not saved in URL, localStorage or a backend

## Local development

You need **Node.js 20+ only on the development machine**. It is **not** needed on the web server or on visitors' devices.

~~~sh
npm install
npm run dev
~~~

Open the Vite URL printed in the terminal. No model is downloaded until you consent in the app.

To run the self-contained, backend-free utility tests:

~~~sh
npm test
~~~

## Build and deploy manually

~~~sh
npm run build
~~~

This creates **dist/** with all frontend HTML/CSS/JavaScript, the app icon, manifest, service worker and generated precache list. The postbuild script only prepares static files; it does **not** upload anything.

**Deploy by copying the contents of dist/** to any static web host (Nginx, Apache, object storage, shared hosting, static CDN, etc.). There are **no GitHub Actions, GitHub Pages configuration, CI/CD pipelines, Docker services, API servers or production Node processes**.

The Vite base is relative, so the site can be deployed at a root domain or under a subdirectory. Use **HTTPS** (or localhost while developing), correct MIME types for JS/CSS/JSON, and ordinary static-file serving. No SPA rewrite rules are required; this application has one page.

### Model hosting

By default, the app fetches **static model assets** from:
[onnx-community/translategemma-text-4b-it-ONNX](https://huggingface.co/onnx-community/translategemma-text-4b-it-ONNX).

This is still **zero backend compute**: the files are downloaded to the browser and inference runs locally via WebGPU. The hosting provider can see normal asset-download metadata such as IP addresses, **not translation input**. The approximately **3.1 GB** model download is intentionally opt-in. The runtime may also load static WASM/runtime artifacts from upstream package locations as required.

If you later want **every network request to use your own host**, add the model weights, runtime assets and appropriate Transformers.js configuration to your static deployment. Those large files are not checked into this Git repository. Verify Google's [Gemma terms](https://ai.google.dev/gemma/terms) and upstream ONNX redistribution terms before distributing copies of model weights.

## Device compatibility

TranslateGemma 4B currently uses a quantized ONNX model and **WebGPU**. WebGPU availability, shader support and GPU memory differ by browser and device. Up-to-date Chrome/Edge desktop are the primary targets for the first validation. The **interface is responsive on Android and iOS**, but some mobile devices do not have enough GPU memory, WebGPU support or storage to translate with this 4B model. There is **no hidden cloud fallback** and the UI explains this clearly.

Do **not** assume all browsers can load the model just because they can display the site. No weaker model is silently substituted. A future small-model fallback should be quality benchmarked first.

### Offline behavior

The service worker precaches the **application shell assets** on install. Transformers.js can cache downloaded models locally where browser storage permits, but storage is subject to eviction. Complete offline translation also depends on cached inference runtime resources and browser support; test it on your devices before promising offline operation. Initial model setup always requires network access unless you self-host and preprovision assets.

## UX and privacy decisions

- **Explicit Translate button**, not every-keystroke inference: 4B inference is costly on mobile and would drain battery if triggered while typing.
- **Explicit source language** instead of unverified automatic detection: TranslateGemma's official instruction format requires source and target language codes.
- **No text in shareable URLs**, analytics, telemetry or permanent local history.
- Clipboard paste is initiated by user interaction; denied clipboard permissions are handled gracefully.
- If text or language selection changes during generation, out-of-date results are discarded. The current running GPU segment may still complete before cancellation is observed.
- Long documents are split into independent chunks; paragraph-level context can be lost between chunks. For legal or contractual text, human review is essential.

## Repository layout

~~~text
index.html                    User interface structure
src/main.js                   State, interactions and local model lifecycle
src/styles.css                Responsive design system
src/languages.js              Model-compatible language codes
src/text.js                   Segmenting and size formatting
src/translation.js            TranslateGemma / Transformers.js integration
public/manifest.webmanifest   Installable PWA metadata
public/sw.js                  Static shell cache
scripts/postbuild.mjs         Generate cache manifest after manual build
tests/text.test.mjs           Node built-in tests (no test framework dependency)
vite.config.js                Relative assets for portable static hosting
~~~

## Attribution and reference implementation

- [Google TranslateGemma 4B model card and prompt format](https://huggingface.co/google/translategemma-4b-it)
- [ONNX WebGPU model](https://huggingface.co/onnx-community/translategemma-text-4b-it-ONNX)
- [webml-community / TranslateGemma-WebGPU](https://github.com/webml-community/TranslateGemma-WebGPU) — reference for the compatible q4 WebGPU loading and structured translation request
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [Gemma terms](https://ai.google.dev/gemma/terms)

The interface and state handling in this project are original; the model integration follows published usage examples.

## Suggested next validation

1. Load and translate English → German on a desktop with sufficient WebGPU memory.
2. Test Czech → German, Ukrainian → Polish, French → Spanish and reverse directions.
3. Test a high-end Android phone and an iPhone: download size, GPU memory, browser support and cold/warm latency.
4. Review the quality of business emails, product descriptions and tricky terminology against human references.
5. Decide whether a smaller, **benchmarked** mobile fallback is needed.
