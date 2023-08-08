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

  abstract remove(index: number): IQueueTrack | undefined;

  abstract insert(index: number, track: IQueueTrack): any;

  abstract incrementTimestamp(track: IQueueTrack): number;

  public timestampInterval: any;

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
      clearInterval(this.timestampInterval)
      this.timestampInterval = setInterval(this.increaseTimestamp.bind(this), 1000);
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

  shuffle(customArray?: Array<any>): BaseQueue | Array<any> {
    const queue = customArray || this.queue;

    if (queue) {
      // Durstenfeld shuffle
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
    }

    if (!customArray) {
      this.queue = queue;
      return this;
    }

    return customArray;
  }

  formatDuration (duration: number): String {
    // :param duration: miliseconds
    // We can use Moment.js library in the future, if needed

    if (duration / 1000 < 3600) {
      return new Date(duration).toISOString().substring(14, 19)
    }

    return new Date(duration).toISOString().substring(11, 19)
  }

  increaseTimestamp (track: IQueueTrack) {
    if (this.current) {
      this.current.timestamp = this.incrementTimestamp(this.current)
    }
  }
}
