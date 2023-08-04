import { Video, YouTube } from 'youtube-sr';

import AbstractProvider, { ProviderSearchList, ProviderSearchItem, ProviderSearchOneResult } from '#services/providers/AbstractProvider';

export default class YouTubeScrapedProvider extends AbstractProvider {
  protected LIMIT = 100;
  protected NUMBER_OF_REQUESTS = 3;

  public async search(query: string): Promise<ProviderSearchList> {
    const result = await YouTube.search(query, { type: 'video', limit: 5 });
    return this.transformSearchData(result);
  }

  public async searchOne(query: string): Promise<ProviderSearchOneResult | null> {
    if (YouTube.validate(query, 'PLAYLIST')) {      

      // We always have one request
      const result = await YouTube.getPlaylist(query, { limit: this.LIMIT });
      for (let i = 1; i < this.NUMBER_OF_REQUESTS && result.videoCount > i * this.LIMIT; i++) {
        await result.next();
      }

      return {
        type: 'list',
        result: this.transformSearchData(result.videos),
      }
    } else if (YouTube.validate(query, 'VIDEO')) {
      const result = await YouTube.getVideo(query);
      return {
        type: 'item',
        result: this.transformVideoResultData(result),
      }
    }

    const result = await YouTube.searchOne(query, 'video');
    if (result !== null) {
      return {
        type: 'item',
        result: this.transformVideoResultData(result),
      }
    }

    return null;
  }

  public async suggestions(query: string): Promise<string[]> {
    const result = await YouTube.getSuggestions(query);
    return result;
  }

  private transformSearchData(data: Video[]): ProviderSearchList {
    const items: ProviderSearchItem[] = [];

    for (const item of data) {
      items.push(this.transformVideoResultData(item));
    }

    return {
      items
    }
  }

  private transformVideoResultData(video: Video): ProviderSearchItem {
    return {
      title: video.title ?? 'N/A',
      description: video.description ?? 'N/A',
      duration: video.duration,
      sourceUrl: video.url,
      author: {
        title: video.channel?.name ?? 'N/A',
        profileUrl: video.channel?.url ?? undefined,
      },
      thumbnailUrl: video.thumbnail?.url ?? undefined,
      // Date of upload while scraping is really vague.
      // publishedAt: item.uploadedAt ? new Date(item.uploadedAt) : undefined,
    }
  }
}
