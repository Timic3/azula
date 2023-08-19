import { VoiceBasedChannel } from 'discord.js';

import BaseQueue from '#services/queue/BaseQueue';
import GuildIdResolver from '#services/resolvers/GuildIdResolver';
import StandardQueue from '#services/queue/StandardQueue';
import { container } from '@sapphire/framework';
import { IQueueTrack } from './IQueue';
import { EmbedBuilder } from '@discordjs/builders';

export default class QueueManager extends GuildIdResolver<BaseQueue> {
  async create(voiceChannel: VoiceBasedChannel): Promise<BaseQueue> {
    const queue = this.get(voiceChannel.guildId);
    if (queue) return queue;

    const voice = await container.voiceManager.join(voiceChannel);
    const newQueue = new StandardQueue(
      voiceChannel,
      voice
    );

    this.add(voiceChannel.guildId, newQueue);

    return newQueue;
  }

  async skip(voiceChannel: VoiceBasedChannel): Promise<[IQueueTrack | null, IQueueTrack | null]> {
    const queue = await this.create(voiceChannel);
    const [skipped, current] = queue.skip();
    return [skipped, current];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async shuffle(voiceChannel: VoiceBasedChannel, customArray?: Array<any>): Promise<BaseQueue | Array<any>> {
    const queue = await this.create(voiceChannel);
    return queue.shuffle(customArray);
  }

  private buildPlayerSlider (currentTimestamp: number, duration: number) {
    const slider = '───────────────────────────────────';
    const value = Math.floor((slider.length - 1) * currentTimestamp / duration);
    
    return `${slider.substring(0, value)}⬤${slider.substring(value + 1)}`;
  }

  public buildQueueEmbed(voiceChannel: VoiceBasedChannel, queue: BaseQueue): EmbedBuilder | undefined {
    // TODO: We can add buttons to manipulate the queue (pagination, skip, etc.))
    let queueEmbed;
    if (queue.current) {
      const queueTitles = queue.queue.slice(0, 5).map((item, index) => `\`${index + 1}. ${item.title} (${queue.formatDuration(item.duration || 0)})\``);
      const itemsRemaining = (queue?.queue?.length || 0) - (queueTitles?.length || 0);
      const totalPlayTime = [queue.current.duration || 0, ...queue.queue.map(item => item.duration || 0)].reduce((a, b) => a + b, 0);

      const voice = container.voiceManager.get(voiceChannel.guildId);
      const currentTimestamp = voice?.getPlaybackDuration() || 0;
      const duration = queue.current.duration || 0;

      const currentSongValue = `
      \`${queue.current.title}\`
      **${queue.formatDuration(currentTimestamp)} ${this.buildPlayerSlider(currentTimestamp, duration)} ${queue.formatDuration(duration)}**
      `;

      queueEmbed = new EmbedBuilder()
        .setColor(0xE0812D)
        .setThumbnail(queue.current.thumbnail || "")
        .addFields(
          { "name": `Current song playing:`, "value": currentSongValue, "inline": true },
          { "name": `Next items in queue:`, "value": queueTitles.length ? `${queueTitles.join('\n')}` : "No further items in queue." }
        );
      if (itemsRemaining){
        queueEmbed.addFields({ "name": "\u200B", "value": `And \`${itemsRemaining}\` other items. Total playtime is \`${queue.formatDuration(totalPlayTime)}\`.` });
      } else {
        queueEmbed.addFields({ "name": "\u200B", "value": `Total playtime is \`${queue.formatDuration(totalPlayTime)}\`.` });
      }
    }
    return queueEmbed;
  }
}
