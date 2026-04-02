import { ClientType, YTNodes } from 'youtubei.js';
import { Innertube } from 'youtubei.js';

import { USER_AGENT } from 'bgutils-js';

const CLIENT = ClientType.WEB;
const LIMIT = 500;

export const youtube = await Innertube.create({
  user_agent: USER_AGENT,
  client_type: CLIENT,
  generate_session_locally: false,
  retrieve_player: true,
  enable_session_cache: false,
});

export async function getVideoSearchResults(query: string) {
  const search = await youtube.search(query, { type: 'video' });
  const videos = search.videos.filterType(YTNodes.Video) as YTNodes.Video[];
  return videos;
}

export async function getPlaylistVideoResults(playlistId: string) {
  let feed = await youtube.getPlaylist(playlistId);
  let videos = feed.videos.filterType(YTNodes.PlaylistVideo) as YTNodes.PlaylistVideo[];

  while (feed.has_continuation && videos.length < LIMIT) {
    feed = await feed.getContinuation();
    videos = videos.concat(feed.videos.filterType(YTNodes.PlaylistVideo) as YTNodes.PlaylistVideo[]);
  }

  return videos;
}

export async function getSuggestionResults(query: string) {
  const suggestions = await youtube.getSearchSuggestions(query);
  return suggestions;
}

export function getVideoIdFromUrl(youtubeUrl: string): string | false {
  const match = youtubeUrl.match(/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/);
  return (match && match[7].length === 11) ? match[7] : false;
}

export function getPlaylistIdFromUrl(youtubeUrl: string): string | false {
  const match = youtubeUrl.match(/^.*(youtu.be\/|list=)([^#&?]*).*/);
  return (match && match[2]) ? match[2] : false;
}

export async function getAudioReadableStream(videoId: string) {
  return youtube.download(videoId, { type: 'audio', quality: 'best' });
}

// export { createSabrStream } from './method/onesie.js';
export { createSabrStream } from './method/sabr.js';
