export function languageKey(name: string) {
  return name.trim().normalize('NFC').toLowerCase();
}

export function languagePair(source: string, target: string) {
  return `${languageKey(source)}->${languageKey(target)}`;
}

export function languageDirection(direction: string): [string, string] | undefined {
  const parts = direction.split(/->|→/u).map((part) => part.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1] || languageKey(parts[0]) === languageKey(parts[1])) return undefined;
  return [parts[0], parts[1]];
}

export function parseLanguagePair(direction: string) {
  const pair = languageDirection(direction);
  return pair ? languagePair(...pair) : undefined;
}
