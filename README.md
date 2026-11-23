# TranslateTheThings

**High-quality translation in your browser — without a translation backend.**

A polished, mobile-responsive, manually deployed static translator with two opt-in, local-only translation engines:

| Mode | Model | Approx. first model download | Inference | Use it for |
| --- | --- | --- | --- | --- |
| **Everyday (default)** | [NLLB-200 distilled 600M](https://huggingface.co/Xenova/nllb-200-distilled-600M), quantized | **~0.9 GB** | CPU / WebAssembly in a Web Worker | First-run practicality, mobile trials, European-language translation |
| **Premium (optional)** | [TranslateGemma 4B ONNX](https://huggingface.co/onnx-community/translategemma-text-4b-it-ONNX), q4 | **~3.1 GB** | WebGPU | More demanding wording and quality comparisons on capable hardware |

**Important:** Premium is not automatically better for *every* text or language direction, and Everyday is not guaranteed to achieve professional translation quality. The two engines have different strengths, and we still need benchmark results for Czech, Ukrainian and other priority European language pairs. The user explicitly chooses when to download either model; no hidden remote inference or silent change of engine occurs.

## Why two models?

The 4B premium engine is too large for many mobile devices, while NLLB has a stable, documented browser translation interface and language coverage. Its int8 ONNX weights occupy roughly 0.9 GB across encoder and decoder (plus tokenizer/runtime assets), rather than 3.1 GB for the premium model. On some phones, 0.9 GB is **still too large** for reliable use. Support depends on available RAM, browser and storage.

We considered Tencent HY-MT1.5 1.8B because of its quality, but **its license explicitly excludes the EU and UK**. We deliberately did **not** integrate it into this Europe-focused product. The newer [Hy-MT2 1.8B](https://huggingface.co/tencent/Hy-MT2-1.8B) has an Apache-2.0 license and strong published results, but lacks a fully verified cross-browser Transformers.js integration at the moment. It is worth investigating after validating this release.

## Features

- **Everyday / Premium switcher** with independent model loading and size estimates; an already-loaded engine is retained when switching back
- On-device translation with no account, analytics, remote translation API or server-side computation
- English, German, French, Spanish, Czech, Ukrainian, Polish, Italian, Portuguese, Dutch, Romanian, Slovak, Hungarian and other European languages
- Extended language list in Premium; Everyday exposes only languages with explicitly mapped NLLB language codes
- Responsive desktop and mobile editor, light and dark themes, clipboard paste/copy, language swapping, sample translations and Ctrl/Cmd+Enter
- Explicit translation trigger (no automatic 4B inference on every keystroke)
- Long-input segmentation up to 4,000 characters; no invisible external translation service
- Clear model download consent, progress, local caching when available and failure messages
- CPU Everyday inference runs inside a **Web Worker**, keeping the editor responsive; Premium retains WebGPU generation
- Basic offline application-shell support (model files may be evicted by browsers)

## Run and build manually

Node.js **20+ is needed on the development/build machine only**. No Node, Python or backend is used by the production website.

~~~sh
npm install
npm test
npm run dev
~~~

For manual production deployment:

~~~sh
npm run build
~~~

Upload the **contents of `dist/`** to a normal HTTPS static web host. Everything required for the application interface is produced in `dist/`; the large model files are loaded from Hugging Face's public static file hosting only when approved by the visitor. No GitHub Pages, GitHub Actions, CI/CD, serverless functions, inference API endpoints, production Node processes or runtime Python services are used.

Build configuration uses relative asset paths so a site can be deployed under a subdirectory. Use standard MIME types for JavaScript, JSON, WASM and static resources, and HTTPS for the service worker and WebGPU where supported. The postbuild script prepares a static precache manifest but does not deploy anything.

### Static model assets and privacy

Downloaded model weights, tokenizers and runtime data are **static files**, not inference API calls. Translation input is processed locally in the current browser. Normal asset hosting logs (e.g. IP address or model file requests) can still be collected by the file host. There are no text-upload requests, telemetry, accounts or translation history in the app.

If you want all network requests to use **your own static host** later, explicitly copy model assets and configure Transformers.js to use those static paths after checking redistributable terms. The multi-GB model weights are deliberately not checked into the Git repository.

### Compatibility

- **Everyday**: uses the NLLB browser ONNX translation pipeline with `device: 'wasm'` and `dtype: 'q8'`. This avoids any requirement for WebGPU, but still uses substantial storage and RAM; some mobile devices may struggle.
- **Premium**: uses TranslateGemma 4B, WebGPU and substantially more memory. The app checks WebGPU before offering it.
- **Offline**: the application shell is cached after initial use. Model reuse and full offline inference depend on browsers retaining model weights and supporting runtime assets; neither is guaranteed.
- **UI**: mobile touch targets, accessible status messages, color-theme support and stacked translation panels.

## Licensing matters, even for a free website

- **NLLB-200 distilled 600M**: [CC BY-NC 4.0](https://huggingface.co/facebook/nllb-200-distilled-600M). Noncommercial use is restricted by the license terms; a *free* website does not automatically mean every possible use by European businesses is noncommercial. **Review the model license before production distribution or commercial/business deployment.**
- **TranslateGemma**: [Google Gemma Terms](https://ai.google.dev/gemma/terms), a separate model usage agreement rather than an OSI-approved open-source software license.

The website JavaScript is separate from the models' licensing terms. Model copyright notices should remain available to end users if you self-host their weights.

## Translation quality validation

Before promoting either mode as production quality, compare the same examples across both engines, especially:

1. **Czech ↔ German**, **Czech ↔ English**, **Ukrainian ↔ Polish**, **Ukrainian ↔ English**;
2. **German ↔ French**, **Spanish ↔ English**, **Italian ↔ German**;
3. Business emails, product descriptions, contract-like language, negation, numbers/dates, domain terminology, HTML-looking text and idioms;
4. Translation fidelity and omissions, not just fluency; measure cold/warm latency and memory on desktop and real Android/iOS devices.

We should also benchmark [Hy-MT2 1.8B](https://huggingface.co/tencent/Hy-MT2-1.8B) as a potential future quality upgrade to the Everyday mode once its browser conversion is proven.

## Project layout

~~~text
index.html                   Browser UI including the engine switcher
src/main.js                  Translation UI / lifecycle / progress / local preferences
src/languages.js             UI language options and filtering
src/models.js                Model descriptions, size estimates and NLLB code mapping
src/everyday.worker.js       NLLB q8 inference off the main thread
src/everyday.js              Message-based worker adapter
src/translation.js           Premium TranslateGemma 4B adapter
src/text.js                  Text splitting and progress formatting
src/styles.css               Responsive UI and light/dark appearance
public/sw.js                 Versioned static application-shell caching
scripts/postbuild.mjs        Manual-build precache manifest generator
tests/*.test.mjs             Small built-in Node tests; no CI required
~~~

## Source references

- [NLLB ONNX / Transformers.js browser usage](https://huggingface.co/Xenova/nllb-200-distilled-600M)
- [TranslateGemma browser example](https://github.com/webml-community/TranslateGemma-WebGPU)
- [TranslateGemma ONNX model](https://huggingface.co/onnx-community/translategemma-text-4b-it-ONNX)
- [Hy-MT2 1.8B](https://huggingface.co/tencent/Hy-MT2-1.8B)
- [Hy-MT1.5 license — excludes EU, UK and South Korea](https://huggingface.co/tencent/HY-MT1.5-1.8B/blob/main/License.txt)
