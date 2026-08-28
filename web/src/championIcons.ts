interface DataDragonChampion {
  key: string;
  image: {
    full: string;
  };
}

interface ChampionDataResponse {
  data: Record<string, DataDragonChampion>;
}

let iconMap: Map<number, string> | null = null;

export async function loadChampionIcons(): Promise<Map<number, string>> {
  if (iconMap) {
    return iconMap;
  }

  const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');

  if (!versionsResponse.ok) {
    throw new Error('Could not load Data Dragon versions');
  }

  const versions: string[] = await versionsResponse.json();

  const version = versions[0];

  const championsResponse = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
  );

  if (!championsResponse.ok) {
    throw new Error('Could not load champion data');
  }

  const champions: ChampionDataResponse = await championsResponse.json();

  iconMap = new Map();

  for (const champion of Object.values(champions.data)) {
    iconMap.set(
      Number(champion.key),
      `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.image.full}`,
    );
  }

  return iconMap;
}
