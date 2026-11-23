// Codes mirror supported TranslateGemma language tags, rather than inferred ISO codes.
// Source: https://huggingface.co/google/translategemma-4b-it
export const FEATURED = [
  ['en', 'English'], ['de_DE', 'German'], ['fr_FR', 'French'],
  ['es', 'Spanish'], ['cs_CZ', 'Czech'], ['uk_UA', 'Ukrainian'],
  ['pl_PL', 'Polish'], ['it_IT', 'Italian'], ['pt_PT', 'Portuguese'],
  ['nl_NL', 'Dutch'], ['ro_RO', 'Romanian'], ['sk_SK', 'Slovak'],
  ['hu_HU', 'Hungarian'], ['sv_SE', 'Swedish'], ['da_DK', 'Danish'],
  ['fi_FI', 'Finnish'],
];
export const ADDITIONAL = [
  ['ar_EG', 'Arabic (Egypt)'], ['ar_SA', 'Arabic (Saudi Arabia)'],
  ['bg_BG', 'Bulgarian'], ['bn_IN', 'Bengali'], ['ca_ES', 'Catalan'],
  ['el_GR', 'Greek'], ['et_EE', 'Estonian'], ['fa_IR', 'Persian'],
  ['fil_PH', 'Filipino'], ['fr_CA', 'French (Canada)'], ['gu_IN', 'Gujarati'],
  ['he_IL', 'Hebrew'], ['hi_IN', 'Hindi'], ['hr_HR', 'Croatian'],
  ['id_ID', 'Indonesian'], ['is_IS', 'Icelandic'], ['ja_JP', 'Japanese'],
  ['kn_IN', 'Kannada'], ['ko_KR', 'Korean'], ['lt_LT', 'Lithuanian'],
  ['lv_LV', 'Latvian'], ['ml_IN', 'Malayalam'], ['mr_IN', 'Marathi'],
  ['no_NO', 'Norwegian'], ['pa_IN', 'Punjabi'], ['pt_BR', 'Portuguese (Brazil)'],
  ['ru_RU', 'Russian'], ['sl_SI', 'Slovenian'], ['sr_RS', 'Serbian'],
  ['sw_KE', 'Swahili'], ['sw_TZ', 'Swahili (Tanzania)'],
  ['ta_IN', 'Tamil'], ['te_IN', 'Telugu'], ['th_TH', 'Thai'],
  ['tr_TR', 'Turkish'], ['ur_PK', 'Urdu'], ['vi_VN', 'Vietnamese'],
  ['zh_TW', 'Chinese (Traditional)'], ['zu_ZA', 'Zulu'],
];
export const LANGUAGES = [...FEATURED, ...ADDITIONAL];
export const SUPPORTED_CODES = new Set(LANGUAGES.map(([code]) => code));
export function populateLanguages(select, selected, isSupported = () => true) {
  const groups = [
    ['Popular in Europe', FEATURED],
    ['More languages', ADDITIONAL],
  ];
  select.replaceChildren();
  for (const [label, languages] of groups) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const [code, name] of languages) {
      if (!isSupported(code)) continue;
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name;
      group.append(option);
    }
    if (group.children.length) select.append(group);
  }
  if (SUPPORTED_CODES.has(selected)) select.value = selected;
}
