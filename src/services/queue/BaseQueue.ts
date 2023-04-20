import { ActivityType, VoiceBasedChannel } from 'discord.js';

import { IQueue, IQueueTrack } from '#services/queue/IQueue';
import Voice from '#services/voice/Voice';
import { container } from '@sapphire/framework';

export default abstract class BaseQueue implements IQueue {
  protected readonly voiceChannel: VoiceBasedChannel;
  protected readonly voice: Voice;

  public current?: IQueueTrack | null;
  public queue: IQueueTrack[] = [];

  constructor(voiceChannel: VoiceBasedChannel, voice: Voice) {
    this.voiceChannel = voiceChannel;
    this.voice = voice;
  }

  abstract enqueue(track: IQueueTrack): any;

  abstract dequeue(): any;

  process() {
    if (this.queue.length === 0) {
      this.current = null;

      // TODO: We should move this somewhere else - preferably on an emitter/listener
      container.client.user?.setPresence({
        activities: [],
      });

      return;
    }

    if (this.current) {
      return;
    }

    this.current = this.dequeue();

    if (this.current) {
      container.logger.info('Now playing...', this.current);

      // TODO: We should move this somewhere else - preferably on an emitter/listener
      container.client.user?.setPresence({
        activities: [
          { name: this.current.title, url: this.current.url, type: ActivityType.Streaming }
        ],
      });

      this.voice.play(this.current.url);
    }
  }
}
