import fs from 'node:fs';
import { PassThrough, Readable } from 'node:stream';

import GoogleVideo, { Format } from 'googlevideo';
import { ClientType, Innertube, YTNodes } from 'youtubei.js';

const CLIENT = ClientType.WEB;
const LIMIT = 500;

let cookies = undefined;
if (fs.existsSync('./persistent/cookies.txt')) {
  console.info('Cookies have been found and loaded!');
  cookies = fs.readFileSync('./persistent/cookies.txt', 'utf8').trim();
}

export const youtube = await Innertube.create({
  client_type: CLIENT,
  // cache: new UniversalCache(true, './persistent/youtube-cache'),
  // cache: new UniversalCache(false),
  generate_session_locally: false,
  // enable_session_cache: false,
  retrieve_player: true,
  visitor_data: process.env.YOUTUBE_VISITOR_DATA ?? undefined,
  po_token: process.env.YOUTUBE_PO_TOKEN ?? undefined,
  cookie: cookies,
});

console.info('cookie:', cookies);
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
    feed = await feed.getContinuation();
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

export async function getSabrStream(videoId: string): Promise<Readable> {
  const info = await youtube.getBasicInfo(videoId);
  const format = info.chooseFormat({ type: 'audio', quality: 'best' });
  const audioFormat: Format = {
    itag: format.itag,
    lastModified: format.last_modified_ms,
    xtags: format.xtags,
  };

  const serverAbrStreamingUrl = youtube.session.player?.decipher(info.page[0].streaming_data?.server_abr_streaming_url);
  const videoPlaybackUstreamerConfig = info.page[0].player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;

  if (!videoPlaybackUstreamerConfig)
    throw new Error('ustreamerConfig not found');

  if (!serverAbrStreamingUrl)
    throw new Error('serverAbrStreamingUrl not found');

  const serverAbrStream = new GoogleVideo.ServerAbrStream({
    fetch: youtube.session.http.fetch_function,
    serverAbrStreamingUrl,
    videoPlaybackUstreamerConfig: videoPlaybackUstreamerConfig,
    durationMs: (info.basic_info?.duration ?? 0) * 1000,
  });

  const audioStream = new PassThrough();

  serverAbrStream.on('data', (streamData) => {
    for (const formatData of streamData.initializedFormats) {
      const isVideo = formatData.mimeType?.includes('video');
      // const mediaFormat = info.streaming_data?.adaptive_formats.find((f) => f.itag === formatData.formatId.itag);
      // const formatKey = formatData.formatKey;

      if (isVideo) continue;

      const mediaChunks = formatData.mediaChunks;

      for (const chunk of mediaChunks) {
        audioStream.write(chunk);
      }
    }
  });

  serverAbrStream.on('error', (error) => {
    console.error(error);
  });

  serverAbrStream.on('end', () => {
    audioStream.end();
  });

  await serverAbrStream.init({
    audioFormats: [ audioFormat ],
    videoFormats: [ ],
    clientAbrState: {
      startTimeMs: 0,
      mediaType: 1,
    },
  });

  return audioStream;
}

export async function getAudioReadableStream(videoId: string) {
  return youtube.download(videoId, { type: 'audio', quality: 'best' });
}
