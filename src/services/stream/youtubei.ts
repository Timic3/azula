import { ClientType, Innertube, YTNodes } from 'youtubei.js';
import { InnerTubeClient } from 'youtubei.js/dist/src/types';

// This combination works for now!
const CLIENT = ClientType.WEB;
const CLIENT_STRING: InnerTubeClient = 'WEB';
const LIMIT = 500;

export const youtube = await Innertube.create({
  client_type: CLIENT,
  // cache: new UniversalCache(true, './persistent/youtube-cache'),
  generate_session_locally: false,
  enable_session_cache: false,
  retrieve_player: true,
  visitor_data: process.env.YOUTUBE_VISITOR_DATA ?? undefined,
  po_token: process.env.YOUTUBE_PO_TOKEN ?? undefined,
});

console.info('visitor_data:', process.env.YOUTUBE_VISITOR_DATA ?? undefined);
console.info('po_token:', process.env.YOUTUBE_PO_TOKEN ?? undefined);

export async function getVideoSearchResults(query: string) {
  const search = await youtube.search(query, { type: 'video' });
  const videos = search.videos.filterType(YTNodes.Video) as YTNodes.Video[];
  return videos;
}

export async function getPlaylistVideoResults(playlistId: string) {
  let videos: YTNodes.PlaylistVideo[] = [];
  let feed = await youtube.getPlaylist(playlistId);

  while (feed.has_continuation && videos.length < LIMIT) {
    videos = videos.concat(feed.videos.filterType(YTNodes.PlaylistVideo) as YTNodes.PlaylistVideo[]);
    feed = await feed.getContinuation()
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

export async function getStreamUrl(videoId: string) {
  const info = await youtube.getBasicInfo(videoId);
  // const url = info.streaming_data?.formats[0].decipher(youtube.session.player);
  const format = info.chooseFormat({ type: 'audio', quality: 'best', client: CLIENT_STRING });
  const url = format.decipher(youtube.session.player);
  console.info('Playback URL:', url);

  return url;
}

export async function getAudioReadableStream(videoId: string) {
  return youtube.download(videoId, { type: 'audio', quality: 'best', client: CLIENT_STRING });
}
