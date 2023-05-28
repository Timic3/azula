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

  async skip(voiceChannel: VoiceBasedChannel): Promise<[IQueueTrack | undefined, IQueueTrack | undefined]> {
    let queue = await this.create(voiceChannel);
    const [skipped, current] = queue.skip()
    return [skipped, current]
  }

  async shuffle(voiceChannel: VoiceBasedChannel, customArray?: Array<any>): Promise<BaseQueue | Array<any>> {
    let queue = await this.create(voiceChannel);
    return queue.shuffle(customArray);
  }

  public buildQueueEmbed(queue: BaseQueue): EmbedBuilder | undefined {
    // TODO: We can add buttons to manipulate the queue (pagination, skip, etc.))
    let queueEmbed;
    if (queue.current) {
      const queueTitles = queue.queue.slice(0, 5).map((item, index) => `\`${index + 1}. ${item.title} \``);
      const itemsRemaining = (queue?.queue?.length || 0) - (queueTitles?.length || 0);
      queueEmbed = new EmbedBuilder()
        .setColor(0xE0812D)
        .addFields(
          { "name": `Current song playing:`, "value": `\`${queue.current.title}\``, "inline": true },
          { "name": `Next items in queue:`, "value": queueTitles.length ? `${queueTitles.join('\n')}` : "No further items in queue." }
        );
      if (itemsRemaining){
        queueEmbed.addFields({ "name": "\u200B", "value": `And \`${itemsRemaining}\` other items.` });
      }
    }
    return queueEmbed;
  }
}
