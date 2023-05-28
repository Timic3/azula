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
    this.playCurrent()
  }

  playCurrent() {
    if (this.current) {
      container.logger.info('Now playing...', this.current);

      // TODO: We should move this somewhere else - preferably on an emitter/listener
      container.client.user?.setPresence({
        activities: [
          { name: this.current.title, url: this.current.url, type: ActivityType.Streaming }
        ],
      });

      this.voice.play(this.current.url);
    } else {
      this.voice.stop();
    }
  }

  skip() {
    const skipped = this.current;
    this.current = this.dequeue();
    this.playCurrent();
    return [skipped || undefined, this.current || undefined];
  }

  shuffle(baseQueue?: BaseQueue) {
    const queue = baseQueue?.queue

    // Durstenfeld shuffle
    if (queue) {
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
      baseQueue.queue = queue
      return baseQueue
    } else {
      for (let i = this.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
      }
      
      return this
    }
  }
}
