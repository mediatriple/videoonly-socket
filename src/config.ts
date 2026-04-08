export const DEFAULT_ALLOWED_ORIGINS = [
  'https://panel.mediatriple.net',
  'https://vopanelpp.mediatriple.net',
  'https://mtvosoct1.mediatriple.net',
  'http://localhost',
];

export function resolveAllowedOrigins(
  envValue = process.env.ALLOWED_ORIGINS,
): string[] {
  const rawOrigins = envValue ?? DEFAULT_ALLOWED_ORIGINS.join(',');

  return Array.from(
    new Set(
      rawOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  );
}
