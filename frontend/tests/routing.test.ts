import { describe, expect, it } from 'vitest';
import { createPlayerOverlayPath, getLegacyRedirect } from '../src/routing';

describe('legacy routing', () => {
  it('redirects the legacy admin hash', () => {
    expect(getLegacyRedirect('#admin')).toBe('/admin');
  });
  it('redirects the legacy overlay generator hash', () => {
    expect(getLegacyRedirect('#overlay_generator')).toBe('/overlay-generator');
  });
  it('preserves player overlay query parameters', () => {
    expect(getLegacyRedirect('#overlay?region=EUW&name=Foo&tag=BAR')).toBe(
      '/overlay?region=EUW&name=Foo&tag=BAR',
    );
  });
  it('does not redirect unrelated hashes', () => {
    expect(getLegacyRedirect('#anything-else')).toBeNull();
  });
  it('does not redirect an empty hash', () => {
    expect(getLegacyRedirect('')).toBeNull();
  });
  it('does not redirect similar legacy hashes', () => {
    expect(getLegacyRedirect('#administrator')).toBeNull();
    expect(getLegacyRedirect('#overlay_generator_old')).toBeNull();
  });
});

describe('player overlay routing', () => {
  it('creates a stable event player overlay path', () => {
    expect(
      createPlayerOverlayPath({
        eventId: 42,
        playerId: 7,
      }),
    ).toBe('/overlay/events/42/players/7');
  });
  it('rejects invalid overlay ids', () => {
    expect(() =>
      createPlayerOverlayPath({
        eventId: 0,
        playerId: 7,
      }),
    ).toThrow('Invalid event id');
    expect(() =>
      createPlayerOverlayPath({
        eventId: 42,
        playerId: -1,
      }),
    ).toThrow('Invalid player id');
  });
});
