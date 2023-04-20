
export interface IQueueTrack {
  title: string;
  artist: string;
  description?: string;
  duration?: number;
  thumbnail?: string;
  url: string;
  streamUrl?: string;
}

export interface IQueue {
  enqueue(track: IQueueTrack): void;

  dequeue(): IQueueTrack;
}
