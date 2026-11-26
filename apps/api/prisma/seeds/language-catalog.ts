// Pilot catalogue using existing language names so deployment preserves their database IDs.
export const languageCatalog = [
  'Arabic', 'English', 'Russian', 'Hindi', 'Urdu', 'Bengali', 'Malayalam', 'Tamil', 'Telugu',
  'Panjabi', 'Gujarati', 'Marathi', 'Nepali (individual language)', 'Sinhala', 'Tagalog',
  'Filipino', 'Burmese', 'Indonesian', 'Thai', 'Vietnamese', 'Mandarin Chinese', 'Japanese',
  'Korean', 'Dari', 'Persian', 'Pushto', 'Kurdish', 'Turkish', 'Armenian', 'Azerbaijani',
  'Georgian', 'Kazakh', 'Uzbek', 'Amharic', 'Somali', 'Tigrinya', 'French', 'German', 'Italian',
  'Portuguese', 'Spanish', 'Ukrainian', 'Romanian', 'Polish'
];

const displayLabels = new Map([
  ['Panjabi', 'Punjabi'],
  ['Pushto', 'Pashto'],
  ['Nepali (individual language)', 'Nepali']
]);

export function languageLabel(name: string) {
  return displayLabels.get(name);
}

export function withLanguageLabel(language: { id: number; name: string }) {
  const label = languageLabel(language.name);
  return label ? { ...language, label } : language;
}
