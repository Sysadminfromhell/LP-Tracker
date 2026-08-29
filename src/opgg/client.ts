import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { parseSummonerProfile, parseRecentMatches } from './parser';
import type { SummonerProfile, SummonerMatch } from './types';

const MCP_URL = 'https://mcp-api.op.gg/mcp';

export class OpggClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport;

  constructor() {
    this.client = new Client({
      name: 'lp-tracker',
      version: '0.1.0',
    });

    this.transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  async getRecentMatches(
    gameName: string,
    tagLine: string,
    region: string,
    limit: number = 5,
  ): Promise<SummonerMatch[]> {
    const result = await this.client.callTool({
      name: 'lol_list_summoner_matches',
      arguments: {
        game_name: gameName,
        tag_line: tagLine,
        region,
        limit,
        desired_output_fields: [
          'data.game_history[].id',
          'data.game_history[].created_at',
          'data.game_history[].game_length_second',
          'data.game_history[].game_type',

          'data.game_history[].participants[].champion_id',
          'data.game_history[].participants[].champion_name',
          'data.game_history[].participants[].position',

          'data.game_history[].participants[].stats.result',
          'data.game_history[].participants[].stats.kill',
          'data.game_history[].participants[].stats.death',
          'data.game_history[].participants[].stats.assist',
          'data.game_history[].participants[].stats.minion_kill',
          'data.game_history[].participants[].stats.neutral_minion_kill',
          'data.game_history[].participants[].stats.total_damage_dealt_to_champions',

          'data.game_history[].participants[].items_names[]',

          'data.summoner.lp_histories[].created_at',
          'data.summoner.lp_histories[].elo_point',
          'data.summoner.lp_histories[].tier_info.tier',
          'data.summoner.lp_histories[].tier_info.division',
          'data.summoner.lp_histories[].tier_info.lp',
        ],
      },
    });

    const textBlock = result.content.find((block) => block.type === 'text');

    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('OP.GG did not return match history as text');
    }

    const recentMatches = parseRecentMatches(textBlock.text);

    console.log(
      `[OP.GG] ${gameName}#${tagLine}: ${recentMatches.length} parsed match(es) returned`,
    );

    for (const match of recentMatches) {
      const matchDate = new Date(match.createdAt);
      console.log(
        `[OP.GG] Match ${match.id} | ` +
          `${matchDate.toISOString()} | ` +
          `${match.gameType} | ` +
          `${match.champion} ${match.position} | ` +
          `${match.result} | ` +
          `${match.kills}/${match.deaths}/${match.assists}`,
      );
    }

    if (recentMatches.length === 0) {
      const rawGameCount = (textBlock.text.match(/GameHistory\(/g) ?? []).length;

      console.warn(
        `[OP.GG] ${gameName}#${tagLine}: parser returned 0 matches, ` +
          `raw response contains ${rawGameCount} GameHistory record(s)`,
      );

      if (rawGameCount > 0) {
        console.warn(`[OP.GG] Parser likely does not match the current OP.GG response format`);
      }
    }

    return recentMatches;
  }

  async getSummonerProfile(
    gameName: string,
    tagLine: string,
    region: string,
  ): Promise<SummonerProfile> {
    const result = await this.client.callTool({
      name: 'lol_get_summoner_profile',
      arguments: {
        game_name: gameName,
        tag_line: tagLine,
        region,
        desired_output_fields: [
          'data.summoner.game_name',
          'data.summoner.tagline',
          'data.summoner.profile_image_url',

          'data.summoner.league_stats[].game_type',

          'data.summoner.league_stats[].tier_info.tier',
          'data.summoner.league_stats[].tier_info.division',
          'data.summoner.league_stats[].tier_info.lp',

          'data.summoner.league_stats[].win',
          'data.summoner.league_stats[].lose',
        ],
      },
    });

    const textBlock = result.content.find((block) => block.type === 'text');

    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('OP.GG did not return a text response');
    }

    return parseSummonerProfile(textBlock.text);
  }
}
