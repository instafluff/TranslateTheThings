// Translation engines. Only models with a documented browser inference path are active.
// NLLB uses its own FLORES-200 language codes; unsupported regional variants are
// deliberately not offered in Everyday mode.
export const MODES = Object.freeze({
  everyday: {
    id: 'everyday',
    name: 'NLLB-200',
    variant: '600M · Everyday',
    sizeLabel: '~0.9 GB',
    approximateBytes: 900_000_000,
    repo: 'Xenova/nllb-200-distilled-600M',
    modelUrl: 'https://huggingface.co/Xenova/nllb-200-distilled-600M',
    requiresWebGPU: false,
    introduction: 'A smaller multilingual model built for translation. Runs on your device using WebAssembly, even without WebGPU.',
    disclaimer: 'Faster setup and broader compatibility, but complex language may benefit from Premium.',
  },
  premium: {
    id: 'premium',
    name: 'TranslateGemma',
    variant: '4B · Premium',
    sizeLabel: '~3.1 GB',
    approximateBytes: 3_111_894_696,
    repo: 'onnx-community/translategemma-text-4b-it-ONNX',
    modelUrl: 'https://huggingface.co/onnx-community/translategemma-text-4b-it-ONNX',
    requiresWebGPU: true,
    introduction: 'Google’s larger translation-specialized model prioritizes nuanced and natural wording, with substantial GPU and memory requirements.',
    disclaimer: 'Best reserved for complex text or when you want to compare a second translation.',
  },
});

// Verified FLORES-style codes for languages offered in Everyday mode.
// Omitted regional variants are NOT silently treated as equivalent.
export const NLLB_CODES = Object.freeze({
  en: 'eng_Latn',
  de_DE: 'deu_Latn',
  fr_FR: 'fra_Latn',
  es: 'spa_Latn',
  cs_CZ: 'ces_Latn',
  uk_UA: 'ukr_Cyrl',
  pl_PL: 'pol_Latn',
  it_IT: 'ita_Latn',
  pt_PT: 'por_Latn',
  nl_NL: 'nld_Latn',
  ro_RO: 'ron_Latn',
  sk_SK: 'slk_Latn',
  hu_HU: 'hun_Latn',
  sv_SE: 'swe_Latn',
  da_DK: 'dan_Latn',
  fi_FI: 'fin_Latn',
  bg_BG: 'bul_Cyrl',
  ca_ES: 'cat_Latn',
  el_GR: 'ell_Grek',
  et_EE: 'est_Latn',
  hr_HR: 'hrv_Latn',
  is_IS: 'isl_Latn',
  lt_LT: 'lit_Latn',
  lv_LV: 'lvs_Latn',
  no_NO: 'nob_Latn',
  ru_RU: 'rus_Cyrl',
  sl_SI: 'slv_Latn',
  sr_RS: 'srp_Cyrl',
  tr_TR: 'tur_Latn',
});
export function supportedByMode(code, mode) {
  return mode === 'premium' || Object.hasOwn(NLLB_CODES, code);
}
