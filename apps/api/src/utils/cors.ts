export function parseCorsOrigins(originsValue: string | undefined): string[] {
  return (originsValue ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: Set<string>,
  isProduction: boolean
): boolean {
  if (!origin) return true;
  if (!isProduction && allowedOrigins.size === 0) return true;
  return allowedOrigins.has(origin);
}
