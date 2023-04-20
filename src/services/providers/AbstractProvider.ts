
export interface ProviderSearchList {
  items: ProviderSearchResult[];
}

export interface ProviderSearchResult {
  title: string;
  description: string;
  duration?: number;
  sourceUrl: string;
  thumbnailUrl?: string; // We'll extend this if there will be a need for it
  author: ProviderSearchAuthor;
  publishedAt?: Date;
}

export interface ProviderSearchAuthor {
  title: string;
  profileUrl?: string;
}

export default abstract class AbstractProvider {
  protected apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public abstract search(query: string): Promise<ProviderSearchList>;

  public abstract suggestions(query: string): Promise<string[]>;
}
