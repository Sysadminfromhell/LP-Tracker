let dataDragonVersion: string | null = null;

async function getDataDragonVersion(): Promise<string> {
  if (dataDragonVersion) {
    return dataDragonVersion;
  }
  const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
  if (!response.ok) {
    throw new Error('Could not load Data Dragon versions');
  }
  const versions: string[] = await response.json();
  const version = versions[0];
  if (!version) {
    throw new Error('Data Dragon returned no version');
  }
  dataDragonVersion = version;
  return version;
}
export async function loadItemIconUrls(itemIds: string[]): Promise<Map<string, string>> {
  const version = await getDataDragonVersion();
  const icons = new Map<string, string>();
  for (const itemId of itemIds) {
    if (!itemId || itemId === '0') {
      continue;
    }

    icons.set(
      itemId,
      `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${encodeURIComponent(itemId)}.png`,
    );
  }
  return icons;
}
