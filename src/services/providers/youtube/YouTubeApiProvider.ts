import { request } from 'undici';

import AbstractProvider, { ProviderSearchList, ProviderSearchResult } from '#services/providers/AbstractProvider';
import { Schema$SearchListResponse } from '#services/providers/youtube/interface/YouTubeApiSearchSchema';

export default class YouTubeApiProvider extends AbstractProvider {
  public async search(query: string): Promise<ProviderSearchList> {
    const { body } = await request(`https://www.googleapis.com/youtube/v3/search`, {
      query: {
        part: 'snippet',
        q: query,
        key: this.apiKey,
        type: 'video',
      },
      headers: {
        'User-Agent': 'XMLHttpRequest',
      }
    });

    return this.transformSearchData((await body.json()) as Schema$SearchListResponse);
  }

  public async suggestions(query: string): Promise<string[]> {
    return [];
  }

  private transformSearchData(data: Schema$SearchListResponse): ProviderSearchList {
    const items: ProviderSearchResult[] = [];

    for (const item of data.items ?? []) {
      if (!item.id?.videoId) continue;

      items.push({
        title: item.snippet?.title ?? 'N/A',
        description: item.snippet?.description ?? 'N/A',
        sourceUrl: `https://youtube.com/watch?v=${item.id.videoId}`,
        author: {
          title: item.snippet?.channelTitle ?? 'N/A',
          profileUrl: item.snippet?.channelId ? `https://youtube.com/channel/${item.snippet.channelId}` : undefined,
        },
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? undefined,
        publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : undefined,
      });
    }

    return {
      items
    };
  }
}
