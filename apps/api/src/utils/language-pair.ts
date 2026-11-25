export function languagePair(source: string, target: string) {
  return `${source.trim().normalize('NFC').toLowerCase()}->${target.trim().normalize('NFC').toLowerCase()}`;
}

export function parseLanguagePair(direction: string) {
  const parts = direction.split(/->|→/u).map((part) => part.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) return undefined;
  return languagePair(parts[0], parts[1]);
}
