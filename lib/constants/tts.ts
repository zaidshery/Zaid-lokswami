export type TtsLanguageOption = {
  code: string;
  label: string;
};

export type TtsVoiceOption = {
  id: string;
  label: string;
};

export const TTS_PROVIDER = 'manual' as const;
export const TTS_DEFAULT_VOICE = 'Default';
export const TTS_OUTPUT_MIME_TYPE = 'audio/mpeg';
export const TTS_MAX_TOTAL_CHARS = 9000;

export const TTS_LANGUAGE_OPTIONS: TtsLanguageOption[] = [
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'en-IN', label: 'English' },
  { code: 'bn-IN', label: 'Bangla' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'kok-IN', label: 'Konkani' },
  { code: 'mai-IN', label: 'Maithili' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'or-IN', label: 'Odia' },
  { code: 'pa-IN', label: 'Punjabi' },
  { code: 'sd-IN', label: 'Sindhi' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'ur-IN', label: 'Urdu' },
];

export const TTS_VOICE_OPTIONS: TtsVoiceOption[] = [
  { id: 'manual-upload', label: 'Manual Upload' },
];

function normalizeCode(value: string) {
  return value.trim().toLowerCase();
}

export function getTtsBaseLanguage(value: string) {
  return normalizeCode(value).split('-')[0] || '';
}

export function isSupportedTtsLanguage(code: string) {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) {
    return false;
  }

  return TTS_LANGUAGE_OPTIONS.some((item) => {
    const normalizedItemCode = normalizeCode(item.code);
    return (
      normalizedItemCode === normalizedCode ||
      getTtsBaseLanguage(normalizedItemCode) === getTtsBaseLanguage(normalizedCode)
    );
  });
}

export function isSupportedTtsVoice(voice: string) {
  const normalizedVoice = voice.trim().toLowerCase();
  if (!normalizedVoice) {
    return false;
  }

  return TTS_VOICE_OPTIONS.some((item) => item.id.toLowerCase() === normalizedVoice);
}

export function getTtsLanguageLabel(code: string) {
  const normalizedCode = normalizeCode(code);
  const exactMatch = TTS_LANGUAGE_OPTIONS.find(
    (item) => normalizeCode(item.code) === normalizedCode
  );

  if (exactMatch) {
    return exactMatch.label;
  }

  const baseLanguage = getTtsBaseLanguage(code);
  const looseMatch = TTS_LANGUAGE_OPTIONS.find(
    (item) => getTtsBaseLanguage(item.code) === baseLanguage
  );

  return looseMatch?.label || 'the selected language';
}
