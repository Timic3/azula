import { Collection } from 'discord.js';

export default abstract class GuildIdResolver<T> {
  private collection: Collection<string, T> = new Collection();

  protected add(guildId: string, data: T) {
    if (this.collection.has(guildId)) return;

    this.collection.set(guildId, data);
  }

  get(guildId: string): T | undefined {
    return this.collection.get(guildId);
  }

  delete(guildId: string): boolean {
    return this.collection.delete(guildId);
  }

  protected has(guildId: string): boolean {
    return this.collection.has(guildId);
  }
}
