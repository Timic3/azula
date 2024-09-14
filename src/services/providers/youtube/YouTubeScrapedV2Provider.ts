import { getPlaylistIdFromUrl, getPlaylistVideoResults, getSuggestionResults, getVideoSearchResults } from '#services/stream/youtubei';
import { YTNodes } from 'youtubei.js/agnostic';
import AbstractProvider, { ProviderSearchList, ProviderSearchItem, ProviderSearchOneResult } from '#services/providers/AbstractProvider';

export default class YouTubeScrapedV2Provider extends AbstractProvider {
  public async search(query: string): Promise<ProviderSearchList> {
    const result = await getVideoSearchResults(query);
    return this.transformSearchData(result);
  }

  public async searchOne(query: string): Promise<ProviderSearchOneResult | null> {
    const playlistId = getPlaylistIdFromUrl(query);
    if (playlistId) {
      const result = await getPlaylistVideoResults(playlistId);
  
      if (result.length === 0) return null;

      return {
        type: 'list',
        result: this.transformSearchData(result),
      };
    }

    const result = await getVideoSearchResults(query);

    if (result.length === 0) return null;

    const video = result[0];

    return {
      type: 'item',
      result: this.transformVideoResultData(video),
    };
  }

  public async suggestions(query: string): Promise<string[]> {
    return await getSuggestionResults(query);
  }

  private transformSearchData(data: YTNodes.Video[] | YTNodes.PlaylistVideo[]): ProviderSearchList {
    const items: ProviderSearchItem[] = [];

    for (const item of data) {
      items.push(this.transformVideoResultData(item));
    }

    return {
      items,
    };
  }

  private transformVideoResultData(video: YTNodes.Video | YTNodes.PlaylistVideo): ProviderSearchItem {
    const description = video instanceof YTNodes.Video ? video.description : 'N/A';
    const thumbnail = video instanceof YTNodes.Video ? video.best_thumbnail : undefined;
    return {
      title: video.title.text ?? 'N/A',
      description: description ?? 'N/A',
      duration: video.duration.seconds,
      sourceUrl: `https://www.youtube.com/watch?v=${video.id}`,
      author: {
        title: video.author.name ?? 'N/A',
        profileUrl: video.author.url ?? undefined,
      },
      thumbnailUrl: thumbnail?.url ?? undefined,
      // Date of upload while scraping is really vague.
      // publishedAt: item.uploadedAt ? new Date(item.uploadedAt) : undefined,
    };
  }
}