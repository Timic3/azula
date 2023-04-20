import { Video, YouTube } from 'youtube-sr';

import AbstractProvider, { ProviderSearchList, ProviderSearchResult } from '#services/providers/AbstractProvider';

export default class YouTubeScrapedProvider extends AbstractProvider {
  public async search(query: string): Promise<ProviderSearchList> {
    const result = await YouTube.search(query, { type: 'video', limit: 5 });
    return this.transformSearchData(result);
  }

  public async suggestions(query: string): Promise<string[]> {
    const result = await YouTube.getSuggestions(query);
    return result;
  }

  private transformSearchData(data: Video[]): ProviderSearchList {
    const items: ProviderSearchResult[] = [];

    for (const item of data) {
      items.push({
        title: item.title ?? 'N/A',
        description: item.description ?? 'N/A',
        duration: item.duration,
        sourceUrl: item.url,
        author: {
          title: item.channel?.name ?? 'N/A',
          profileUrl: item.channel?.url ?? undefined,
        },
        thumbnailUrl: item.thumbnail?.url ?? undefined,
        // Date of upload while scraping is really vague.
        // publishedAt: item.uploadedAt ? new Date(item.uploadedAt) : undefined,
      });
    }

    return {
      items
    }
  }
}
