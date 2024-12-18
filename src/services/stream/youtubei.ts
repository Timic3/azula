import fs from 'node:fs';
import { PassThrough, Readable } from 'node:stream';

import GoogleVideo, { Format, PART, Protos, QUALITY } from 'googlevideo';
import { ClientType, Constants, Context, Innertube, YT, YTNodes } from 'youtubei.js';
import { decryptResponse, encryptRequest } from '#utils/CryptUtils';

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

export async function getSabrStream(videoId: string): Promise<Readable> {
  // const info = await youtube.getBasicInfo(videoId);
  const info = await getOnesieStream(videoId);
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

// Onesie

export async function getOnesieStream(videoId: string) {
  return getBasicInfo(youtube, videoId);
}

type ClientConfig = {
  clientKeyData: Uint8Array;
  encryptedClientKey: Uint8Array;
  onesieUstreamerConfig: Uint8Array;
  baseUrl: string;
};

type OnesieRequestArgs = {
  videoId: string;
  poToken?: string;
  clientConfig: ClientConfig;
  innertube: Innertube;
};

type OnesieRequest = {
  body: Uint8Array;
  encodedVideoId: string;
}

/**
 * Fetches and parses the YouTube TV client configuration.
 * Configurations from other clients can be used as well. I chose TVHTML5 for its simplicity.
 */
async function getYouTubeTVClientConfig(): Promise<ClientConfig> {
  const tvConfigResponse = await fetch('https://www.youtube.com/tv_config?action_get_config=true&client=lb4&theme=cl', {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version',
    },
  });

  const tvConfig = await tvConfigResponse.text();
  if (!tvConfig.startsWith(')]}'))
    throw new Error('Invalid response from YouTube TV config endpoint.');

  const tvConfigJson = JSON.parse(tvConfig.slice(4));

  const webPlayerContextConfig = tvConfigJson.webPlayerContextConfig.WEB_PLAYER_CONTEXT_CONFIG_ID_LIVING_ROOM_WATCH;
  const onesieHotConfig = webPlayerContextConfig.onesieHotConfig;

  const clientKeyData = base64ToU8(onesieHotConfig.clientKey);
  const encryptedClientKey = base64ToU8(onesieHotConfig.encryptedClientKey);
  const onesieUstreamerConfig = base64ToU8(onesieHotConfig.onesieUstreamerConfig);
  const baseUrl = onesieHotConfig.baseUrl;

  return {
    clientKeyData,
    encryptedClientKey,
    onesieUstreamerConfig,
    baseUrl,
  };
}

/**
 * Prepares a Onesie request.
 */
async function prepareOnesieRequest(args: OnesieRequestArgs): Promise<OnesieRequest> {
  const { videoId, poToken, clientConfig, innertube } = args;
  const { clientKeyData, encryptedClientKey, onesieUstreamerConfig } = clientConfig;
  const clonedInnerTubeContext: Context = structuredClone(innertube.session.context);

  // Change or remove these if you want to use a different client. I chose TVHTML5 purely for testing.
  clonedInnerTubeContext.client.clientName = Constants.CLIENTS.TV.NAME;
  clonedInnerTubeContext.client.clientVersion = Constants.CLIENTS.TV.VERSION;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = {
    playbackContext: {
      contentPlaybackContext: {
        vis: 0,
        splay: false,
        lactMilliseconds: '-1',
        signatureTimestamp: innertube.session.player?.sts,
      },
    },
    videoId,
  };
  
  if (poToken) {
    params.serviceIntegrityDimensions = {};
    params.serviceIntegrityDimensions.poToken = poToken;
  }
  
  const playerRequestJson = {
    context: clonedInnerTubeContext,
    ...params,
  };

  const headers = [ {
    name: 'Content-Type',
    value: 'application/json',
  },
  {
    name: 'User-Agent',
    value: innertube.session.context.client.userAgent,
  },
  {
    name: 'X-Goog-Visitor-Id',
    value: innertube.session.context.client.visitorData,
  } ];

  const onesieRequest = Protos.OnesiePlayerRequest.encode({
    url: 'https://youtubei.googleapis.com/youtubei/v1/player?key=AIzaSyDCU8hByM-4DrUqRUYnGn-3llEO78bcxq8',
    headers,
    body: JSON.stringify(playerRequestJson),
    proxiedByTrustedBandaid: true,
    field6: false,
  }).finish();

  const { encrypted, hmac, iv } = await encryptRequest(clientKeyData, onesieRequest);

  const body = Protos.OnesieRequest.encode({
    urls: [],
    playerRequest: {
      encryptedClientKey,
      encryptedOnesiePlayerRequest: encrypted,
      enableCompression: false,
      hmac: hmac,
      iv: iv,
      TQ: true,
      YP: true,
    },
    clientAbrState: {
      timeSinceLastManualFormatSelectionMs: 0,
      lastManualDirection: 0,
      quality: QUALITY.HD720,
      selectedQualityHeight: QUALITY.HD720,
      startTimeMs: 0,
      visibility: 0,
    },
    streamerContext: {
      field5: [],
      field6: [],
      poToken: poToken ? base64ToU8(poToken) : undefined,
      playbackCookie: undefined,
      clientInfo: {
        clientName: parseInt(Constants.CLIENTS.TV.NAME_ID),
        clientVersion: clonedInnerTubeContext.client.clientVersion,
      },
    },
    bufferedRanges: [],
    onesieUstreamerConfig,
  }).finish();

  const videoIdBytes = base64ToU8(videoId);
  const encodedVideoIdChars = [];

  for (const byte of videoIdBytes) {
    encodedVideoIdChars.push(byte.toString(16).padStart(2, '0'));
  }

  const encodedVideoId = encodedVideoIdChars.join('');

  return { body, encodedVideoId };
}

/**
 * Fetches basic video info (streaming data, video details, etc.) using a Onesie request (/initplayback).
 */
async function getBasicInfo(innertube: Innertube, videoId: string): Promise<YT.VideoInfo> {
  const redirectorResponse = await fetch(`https://redirector.googlevideo.com/initplayback?source=youtube&itag=0&pvi=0&pai=0&owc=yes&cmo:sensitive_content=yes&alr=yes&id=${Math.round(Math.random() * 1E5)}`, { method: 'GET' });
  const redirectorResponseUrl = await redirectorResponse.text();

  if (!redirectorResponseUrl.startsWith('https://'))
    throw new Error('Invalid redirector response');

  const clientConfig = await getYouTubeTVClientConfig();
  const onesieRequest = await prepareOnesieRequest({ videoId, /* If needed - poToken,*/ clientConfig, innertube });

  let url = `${redirectorResponseUrl.split('/initplayback')[0]}${clientConfig.baseUrl}`;

  const queryParams = [];
  queryParams.push(`id=${onesieRequest.encodedVideoId}`);
  queryParams.push('opr=1');
  queryParams.push('por=1');
  queryParams.push('rn=1');
  queryParams.push('cmo:sensitive_content=yes');

  url += `&${queryParams.join('&')}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'content-type': 'text/plain',
    },
    referrer: 'https://www.youtube.com/',
    body: onesieRequest.body,
  });

  const arrayBuffer = await response.arrayBuffer();
  const googUmp = new GoogleVideo.UMP(new GoogleVideo.ChunkedDataBuffer([ new Uint8Array(arrayBuffer) ]));

  const onesie: (Protos.OnesieHeader & { data?: Uint8Array })[] = [];

  googUmp.parse((part) => {
    const data = part.data.chunks[0];
    switch (part.type) {
      case PART.SABR_ERROR:
        console.log('[SABR_ERROR]:', Protos.SabrError.decode(data));
        break;
      case PART.ONESIE_HEADER:
        onesie.push(Protos.OnesieHeader.decode(data));
        break;
      case PART.ONESIE_DATA:
        onesie[onesie.length - 1].data = data;
        break;
      default:
        break;
    }
  });

  const onesiePlayerResponse = onesie.find((header) => header.type === Protos.OnesieHeaderType.PLAYER_RESPONSE);

  if (onesiePlayerResponse) {
    if (!onesiePlayerResponse.cryptoParams)
      throw new Error('Crypto params not found');

    const iv = onesiePlayerResponse.cryptoParams.iv;
    const hmac = onesiePlayerResponse.cryptoParams.hmac;
    const encrypted = onesiePlayerResponse.data;

    const decryptedData = await decryptResponse(iv, hmac, encrypted, clientConfig.clientKeyData);
    const response = Protos.OnesiePlayerResponse.decode(decryptedData);

    if (response.onesieProxyStatus !== 1)
      throw new Error('Onesie proxy status not OK');

    if (response.httpStatus !== 200)
      throw new Error('Http status not OK');

    const playerResponse = {
      success: true,
      status_code: 200,
      data: JSON.parse(new TextDecoder().decode(response.body)),
    };

    return new YT.VideoInfo([ playerResponse ], innertube.actions, '');
  }

  throw new Error('Player response not found');
}

export function u8ToBase64(u8: Uint8Array): string {
  return btoa(String.fromCharCode.apply(null, Array.from(u8)));
}

export function base64ToU8(base64: string): Uint8Array {
  const standard_base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  const padded_base64 = standard_base64.padEnd(standard_base64.length + (4 - standard_base64.length % 4) % 4, '=');
  return new Uint8Array(atob(padded_base64).split('').map((char) => char.charCodeAt(0)));
}
