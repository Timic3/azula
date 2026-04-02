import { UmpReader, CompositeBuffer } from 'googlevideo/ump';
import {
  UMPPartId,
  OnesieInnertubeRequest,
  OnesieHeader,
  SabrError,
  OnesieProxyStatus,
  OnesieInnertubeResponse,
  OnesieRequest,
  CompressionType,
  OnesieHeaderType,
} from 'googlevideo/protos';
import { base64ToU8, buildSabrFormat, EnabledTrackTypes } from 'googlevideo/utils';
import type { Part } from 'googlevideo/shared-types';
import { SabrStream } from 'googlevideo/sabr-stream';
import { Constants, Context, Innertube, Platform, Types, YT } from 'youtubei.js';
import { decryptResponse, encryptRequest } from '#utils/CryptUtils';

import { BG, type BgConfig } from 'bgutils-js';
import { JSDOM } from 'jsdom';

import { youtube } from '../youtubei.js';

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

type UmpPartHandler = (part: Part) => void;

Platform.shim.eval = async (data: Types.BuildScriptResult, env: Record<string, Types.VMPrimative>) => {
  const properties = [];

  if (env.n) {
    properties.push(`n: exportedVars.nFunction("${env.n}")`);
  }

  if (env.sig) {
    properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
  }

  const code = `${data.output}\nreturn { ${properties.join(', ')} }`;

  return new Function(code)();
};

const enableCompression = true;

export async function createSabrStream(videoId: string): Promise<{audioStream: ReadableStream}> {
  const webPoTokenResult = await generateWebPoToken(videoId);

  youtube.session.po_token = webPoTokenResult.poToken;

  const info = await getOnesieStream(videoId);

  if (info.playability_status?.status !== 'OK') {
    console.error(info);
    console.error(info.playability_status?.error_screen);
    throw new Error('onesie request could not find stream');
  }

  const serverAbrStreamingUrl = await youtube.session.player?.decipher(info.page[0].streaming_data?.server_abr_streaming_url);
  const videoPlaybackUstreamerConfig = info.page[0].player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;

  if (!videoPlaybackUstreamerConfig)
    throw new Error('ustreamerConfig not found');

  if (!serverAbrStreamingUrl)
    throw new Error('serverAbrStreamingUrl not found');

  const sabrFormats = info.streaming_data?.adaptive_formats.map(buildSabrFormat) || [];
  console.log('Available formats: ', sabrFormats);

  const serverAbrStream = new SabrStream({
    fetch: youtube.session.http.fetch_function,
    formats: sabrFormats,
    serverAbrStreamingUrl,
    videoPlaybackUstreamerConfig,
    poToken: webPoTokenResult.poToken,
    clientInfo: {
      clientName: parseInt(Constants.CLIENT_NAME_IDS[youtube.session.context.client.clientName as keyof typeof Constants.CLIENT_NAME_IDS]),
      clientVersion: youtube.session.context.client.clientVersion,
    },
  });

  // Handle player reload events here...

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { videoStream, audioStream, selectedFormats } = await serverAbrStream.start({
    preferOpus: true,
    enabledTrackTypes: EnabledTrackTypes.AUDIO_ONLY,
  });
  console.log('Format selected:', selectedFormats);

  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    audioStream,
  };
}

export async function getOnesieStream(videoId: string) {
  return getBasicInfo(youtube, videoId);
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
async function prepareOnesieRequest(args: OnesieRequestArgs) {
  const { videoId, poToken, clientConfig, innertube } = args;
  const { clientKeyData, encryptedClientKey, onesieUstreamerConfig } = clientConfig;
  const clonedInnerTubeContext: Context = structuredClone(innertube.session.context);

  clonedInnerTubeContext.client.clientName = Constants.CLIENTS.TV.NAME;
  clonedInnerTubeContext.client.clientVersion = Constants.CLIENTS.TV.VERSION;

  // YouTube TVHTML5 doesn't let you pass configInfo anymore
  delete clonedInnerTubeContext.client.configInfo;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = {
    playbackContext: {
      contentPlaybackContext: {
        vis: 0,
        splay: false,
        lactMilliseconds: '-1',
        signatureTimestamp: innertube.session.player?.signature_timestamp,
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

  const headers = [
    {
      name: 'Content-Type',
      value: 'application/json',
    },
    {
      name: 'User-Agent',
      value: clonedInnerTubeContext.client.userAgent,
    },
    {
      name: 'X-Goog-Visitor-Id',
      value: clonedInnerTubeContext.client.visitorData,
    },
  ];

  const onesieInnertubeRequest = OnesieInnertubeRequest.encode({
    url: 'https://youtubei.googleapis.com/youtubei/v1/player?key=AIzaSyDCU8hByM-4DrUqRUYnGn-3llEO78bcxq8',
    headers,
    body: JSON.stringify(playerRequestJson),
    proxiedByTrustedBandaid: true,
    skipResponseEncryption: true,
  }).finish();

  const { encrypted, hmac, iv } = await encryptRequest(clientKeyData, onesieInnertubeRequest);

  const body = OnesieRequest.encode({
    urls: [],
    innertubeRequest: {
      enableCompression,
      encryptedClientKey,
      encryptedOnesieInnertubeRequest: encrypted,
      /*
       * If you want to use an unencrypted player request:
       * unencryptedOnesieInnertubeRequest: onesieInnertubeRequest,
       */
      hmac: hmac,
      iv: iv,
      useJsonformatterToParsePlayerResponse: false,
      serializeResponseAsJson: true, // If false, the response will be serialized as protobuf.
    },
    streamerContext: {
      sabrContexts: [],
      unsentSabrContexts: [],
      poToken: poToken ? base64ToU8(poToken) : undefined,
      playbackCookie: undefined,
      clientInfo: {
        clientName: parseInt(Constants.CLIENT_NAME_IDS[clonedInnerTubeContext.client.clientName as keyof typeof Constants.CLIENT_NAME_IDS]),
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
  const onesieRequest = await prepareOnesieRequest({ videoId, poToken: innertube.session.po_token, clientConfig, innertube });

  let url = `${redirectorResponseUrl.split('/initplayback')[0]}${clientConfig.baseUrl}`;

  const queryParams = [];
  queryParams.push(`id=${onesieRequest.encodedVideoId}`);
  queryParams.push('cmo:sensitive_content=yes');
  queryParams.push('opr=1'); // Onesie Playback Request.
  queryParams.push('osts=0'); // Onesie Start Time Seconds.
  queryParams.push('por=1');
  queryParams.push('rn=0');

  /**
   * Add the following search params to get media data parts along with the onesie player response.
   * NOTE: The `osts` is what determines which segment to start playback from.
   *
   * const preferredVideoItags = [ ... ]; // Add your preferred video itags here.
   * const preferredAudioItags = [ ... ];
   * searchParams.push(`pvi=${preferredVideoItags.join(',')}`);
   * searchParams.push(`pai=${preferredAudioItags.join(',')}`);
   */

  url += `&${queryParams.join('&')}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'content-type': 'application/octet-stream',
    },
    referrer: 'https://www.youtube.com/',
    body: onesieRequest.body,
  });

  const arrayBuffer = await response.arrayBuffer();
  const googUmp = new UmpReader(new CompositeBuffer([ new Uint8Array(arrayBuffer) ]));

  const onesie: (OnesieHeader & { data?: Uint8Array })[] = [];

  function handleSabrError(part: Part) {
    const data = part.data.chunks[0];
    const error = SabrError.decode(data);
    console.error('[SABR_ERROR]:', error);
  }

  function handleOnesieHeader(part: Part) {
    const data = part.data.chunks[0];
    onesie.push(OnesieHeader.decode(data));
  }

  function handleOnesieData(part: Part) {
    const data = part.data.chunks[0];
    if (onesie.length > 0) {
      onesie[onesie.length - 1].data = data;
    } else {
      console.warn('Received ONESIE_DATA without a preceding ONESIE_HEADER');
    }
  }

  const umpPartHandlers = new Map<UMPPartId, UmpPartHandler>([
    [ UMPPartId.SABR_ERROR, handleSabrError ],
    [ UMPPartId.ONESIE_HEADER, handleOnesieHeader ],
    [ UMPPartId.ONESIE_DATA, handleOnesieData ],
  ]);

  googUmp.read((part) => {
    const handler = umpPartHandlers.get(part.type);
    if (handler)
      handler(part);
  });

  const onesiePlayerResponse = onesie.find((header) => header.type === OnesieHeaderType.ONESIE_PLAYER_RESPONSE);

  if (onesiePlayerResponse) {
    if (!onesiePlayerResponse.cryptoParams)
      throw new Error('Crypto params not found');

    const iv = onesiePlayerResponse.cryptoParams.iv;
    const hmac = onesiePlayerResponse.cryptoParams.hmac;

    let responseData = onesiePlayerResponse.data;

    // Decompress the response data if compression is enabled.
    if (responseData && enableCompression && onesiePlayerResponse.cryptoParams.compressionType === CompressionType.GZIP) {
      const zlib = await import('node:zlib');
      responseData = new Uint8Array(zlib.gunzipSync(responseData));
    }

    // If skipResponseEncryption is set to true in the request, the response will not be encrypted.
    const decryptedData = hmac?.length && iv?.length ?
      await decryptResponse(iv, hmac, responseData, clientConfig.clientKeyData) : responseData!;
    const response = OnesieInnertubeResponse.decode(decryptedData);

    if (response.onesieProxyStatus !== OnesieProxyStatus.OK)
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

export async function generateWebPoToken(contentBinding: string) {
  const requestKey = 'O43z0dpjhgX20SCx4KAo';

  if (!contentBinding)
    throw new Error('Could not get visitor data');

  const dom = new JSDOM();

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });

  const bgConfig: BgConfig = {
    fetch: (input: string | URL | globalThis.Request, init?: RequestInit) => fetch(input, init),
    globalObj: globalThis,
    identifier: contentBinding,
    requestKey,
  };

  const bgChallenge = await BG.Challenge.create(bgConfig);

  if (!bgChallenge)
    throw new Error('Could not get challenge');

  const interpreterJavascript = bgChallenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;

  if (interpreterJavascript) {
    new Function(interpreterJavascript)();
  } else throw new Error('Could not load VM');

  const poTokenResult = await BG.PoToken.generate({
    program: bgChallenge.program,
    globalName: bgChallenge.globalName,
    bgConfig,
  });

  const placeholderPoToken = BG.PoToken.generatePlaceholder(contentBinding);

  return {
    visitorData: contentBinding,
    placeholderPoToken,
    poToken: poTokenResult.poToken,
  };
}
