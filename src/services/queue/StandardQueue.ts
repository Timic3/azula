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

  remove(index: number): IQueueTrack | undefined {
    if (index < this.queue.length && index > -1) {
      return this.queue.splice(index, 1)[0];
    }
    return undefined
  }

  insert(index: number, track: IQueueTrack): void {
    if (Math.abs(index) < this.queue.length) {
      const calculatedIndex = index >= 0 ? index : this.queue.length - Math.abs(index);
      this.queue.splice(calculatedIndex, 0, track);
    } else {
      this.enqueue(track);
    }
  }
}
