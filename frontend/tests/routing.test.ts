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
  it('creates the player overlay path', () => {
    expect(
      createPlayerOverlayPath({
        region: 'EUW',
        name: 'Foo',
        tag: 'BAR',
      }),
    ).toBe('/overlay?region=EUW&name=Foo&tag=BAR');
  });
  it('encodes player route parameters', () => {
    expect(
      createPlayerOverlayPath({
        region: 'EUW',
        name: 'Foo Bar',
        tag: 'A#B',
      }),
    ).toBe('/overlay?region=EUW&name=Foo+Bar&tag=A%23B');
  });
});
