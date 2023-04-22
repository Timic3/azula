
export interface ProviderSearchList {
  items: ProviderSearchItem[];
}

export interface ProviderSearchItem {
  title: string;
  description: string;
  duration?: number;
  sourceUrl: string;
  thumbnailUrl?: string; // We'll extend this if there will be a need for it
  author: ProviderSearchAuthor;
  publishedAt?: Date;
}

export interface ProviderSearchOneResult {
  type: 'item' | 'list';
  result: ProviderSearchItem | ProviderSearchList;
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

  // TODO: Maybe we should name this better?
  public abstract searchOne(query: string): Promise<ProviderSearchOneResult | null>;

  public abstract suggestions(query: string): Promise<string[]>;
}
