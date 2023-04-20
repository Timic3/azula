import { IQueueTrack } from '#services/queue/IQueue';
import BaseQueue from '#services/queue/BaseQueue';

export default class StandardQueue extends BaseQueue {
  enqueue(track: IQueueTrack): void {
    this.queue.push(track);
    this.process();
  }

  dequeue(): IQueueTrack {
    return this.queue.shift()!;
  }
}
