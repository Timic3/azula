import { VoiceBasedChannel } from 'discord.js';

import BaseQueue from '#services/queue/BaseQueue';
import GuildIdResolver from '#services/resolvers/GuildIdResolver';
import StandardQueue from '#services/queue/StandardQueue';
import { container } from '@sapphire/framework';
import { IQueueTrack } from './IQueue';

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
}
