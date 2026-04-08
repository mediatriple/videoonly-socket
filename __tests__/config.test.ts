import {
  DEFAULT_ALLOWED_ORIGINS,
  resolveAllowedOrigins,
} from '../src/config';

describe('resolveAllowedOrigins', () => {
  test('includes the production panel origin in defaults', () => {
    expect(DEFAULT_ALLOWED_ORIGINS).toContain(
      'https://vopanelpp.mediatriple.net',
    );
  });

  test('uses defaults when env is unset', () => {
    expect(resolveAllowedOrigins(undefined)).toEqual(DEFAULT_ALLOWED_ORIGINS);
  });

  test('trims, filters empty values, and removes duplicates', () => {
    expect(
      resolveAllowedOrigins(
        ' https://panel.mediatriple.net, ,https://vopanelpp.mediatriple.net,https://panel.mediatriple.net ',
      ),
    ).toEqual([
      'https://panel.mediatriple.net',
      'https://vopanelpp.mediatriple.net',
    ]);
  });
});
