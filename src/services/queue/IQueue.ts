
export interface IQueueTrack {
  title: string;
  artist: string;
  description?: string;
  duration?: number;
  thumbnail?: string;
  url: string;
  streamUrl?: string;
  timestamp: number;
}

export interface IQueue {
  enqueue(track: IQueueTrack): void;

  dequeue(): IQueueTrack;

  remove(index: number): IQueueTrack | undefined;

  insert(index: number, track: IQueueTrack): void;

  incrementTimestamp (track: IQueueTrack): number;
}
