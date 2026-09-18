export interface PlayerOverlayRouteParams {
  region: string;
  name: string;
  tag: string;
}

export function getLegacyRedirect(hash: string): string | null {
  if (hash === '#admin') {
    return '/admin';
  }
  if (hash === '#overlay_generator') {
    return '/overlay-generator';
  }
  if (hash.startsWith('#overlay?')) {
    return `/overlay${hash.slice('#overlay'.length)}`;
  }
  return null;
}
export function createPlayerOverlayPath({ region, name, tag }: PlayerOverlayRouteParams): string {
  const params = new URLSearchParams({
    region,
    name,
    tag,
  });

  return `/overlay?${params.toString()}`;
}
