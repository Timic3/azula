import Innertube, { Constants, IPlayerResponse, Platform, Types, UniversalCache, YTNodes } from 'youtubei.js';
import { SabrStream } from 'googlevideo/sabr-stream';
import { buildSabrFormat, EnabledTrackTypes } from 'googlevideo/utils';
import { ReloadPlaybackContext } from 'googlevideo/protos';
import { USER_AGENT } from 'bgutils-js/utils';

import { invalidatePoTokenMinter, mintPoToken } from '../potoken.js';

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

/**
 * The InnerTube session is shared across tracks on purpose: a PO token is only accepted by the
 * SABR server when the player request that produced the streaming URL was made by the very same
 * session. Creating a session per track hands YouTube a token that belongs to someone else, and
 * it responds with `sps: 2` - roughly a minute of media, then nothing.
 *
 * The user agent has to match the one BotGuard attested with, hence bgutils' constant.
 */
let innertubePromise: Promise<Innertube> | undefined;

function getInnertube(): Promise<Innertube> {
  innertubePromise ??= Innertube.create({
    user_agent: USER_AGENT,
    cache: new UniversalCache(true),
  });
  return innertubePromise;
}

export async function createSabrStream(
  videoId: string
): Promise<{
  audioStream: ReadableStream<Uint8Array<ArrayBufferLike>>
}> {
  const innertube = await getInnertube();

  // Web mints a content bound token per video, so the binding is the video ID rather than visitor data.
  const poToken = await mintPoToken(videoId);

  // Get video metadata.
  const playerResponse = await makePlayerRequest(innertube, videoId, poToken);
  const videoTitle = playerResponse.video_details?.title || 'Unknown Video';

  console.info(`
    Title: ${videoTitle}
    Duration: ${playerResponse.video_details?.duration}
    Views: ${playerResponse.video_details?.view_count}
    Author: ${playerResponse.video_details?.author}
    Video ID: ${playerResponse.video_details?.id}
  `);

  if (!playerResponse.streaming_data?.server_abr_streaming_url) {
    console.error(playerResponse.playability_status);
    throw new Error('serverAbrStreamingUrl is not playable');
  }

  // Now get the streaming information.
  const { serverAbrStreamingUrl, videoPlaybackUstreamerConfig } = await resolveStreamingConfig(innertube, playerResponse);

  if (!videoPlaybackUstreamerConfig) throw new Error('ustreamerConfig not found');
  if (!serverAbrStreamingUrl) throw new Error('serverAbrStreamingUrl not found');

  const sabrFormats = playerResponse.streaming_data?.adaptive_formats.map(buildSabrFormat) || [];

  const serverAbrStream = new SabrStream({
    fetch: innertube.session.http.fetch_function,
    formats: sabrFormats,
    serverAbrStreamingUrl,
    videoPlaybackUstreamerConfig,
    poToken,
    durationMs: playerResponse.video_details?.duration ? playerResponse.video_details.duration * 1000 : undefined,
    clientInfo: {
      clientName: parseInt(Constants.CLIENT_NAME_IDS[innertube.session.context.client.clientName as keyof typeof Constants.CLIENT_NAME_IDS]),
      clientVersion: innertube.session.context.client.clientVersion,
    },
  });

  // Anything above 1 means the server rejected our PO token and is only letting the cold start
  // allowance (1-2 MB, about a minute of audio) through, so start over from a fresh attestation.
  // The server repeats this status on every response, so only act on the first one.
  let handledProtectionStatus = false;

  serverAbrStream.on('streamProtectionStatusUpdate', (status) => {
    if ((status.status || 0) < 2 || handledProtectionStatus) return;
    handledProtectionStatus = true;

    console.warn(`Stream protection status ${status.status}, rebuilding attestation`);

    invalidatePoTokenMinter();

    mintPoToken(videoId)
      .then((refreshedPoToken) => serverAbrStream.setPoToken(refreshedPoToken))
      .catch(console.error);
  });

  // Handle player response reload events (e.g, when IP changes, or formats expire).
  serverAbrStream.on('reloadPlayerResponse', async (reloadPlaybackContext) => {
    try {
      const refreshedPoToken = await mintPoToken(videoId);
      const playerResponse = await makePlayerRequest(innertube, videoId, refreshedPoToken, reloadPlaybackContext);
      const { serverAbrStreamingUrl, videoPlaybackUstreamerConfig } = await resolveStreamingConfig(innertube, playerResponse);

      if (serverAbrStreamingUrl && videoPlaybackUstreamerConfig) {
        serverAbrStream.setPoToken(refreshedPoToken);
        serverAbrStream.setStreamingURL(serverAbrStreamingUrl);
        serverAbrStream.setUstreamerConfig(videoPlaybackUstreamerConfig);
      }
    } catch (error) {
      console.error('Could not reload player response', error);
    }
  });

  const { audioStream } = await serverAbrStream.start({
    preferOpus: true,
    enabledTrackTypes: EnabledTrackTypes.AUDIO_ONLY,
  });

  return { audioStream };
}

export async function makePlayerRequest(innertube: Innertube, videoId: string, poToken?: string, reloadPlaybackContext?: ReloadPlaybackContext): Promise<IPlayerResponse> {
  const watchEndpoint = new YTNodes.NavigationEndpoint({ watchEndpoint: { videoId } });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extraArgs: Record<string, any> = {
    playbackContext: {
      contentPlaybackContext: {
        vis: 0,
        splay: false,
        lactMilliseconds: '-1',
        signatureTimestamp: innertube.session.player?.signature_timestamp,
      },
    },
    contentCheckOk: true,
    racyCheckOk: true,
  };

  // Without this the streaming URL is issued to an unattested session, and the SABR server cuts
  // media off once the cold start allowance runs out.
  if (poToken) {
    extraArgs.serviceIntegrityDimensions = { poToken };
  }

  if (reloadPlaybackContext) {
    extraArgs.playbackContext.reloadPlaybackContext = reloadPlaybackContext;
  }

  return await watchEndpoint.call<IPlayerResponse>(innertube.actions, { ...extraArgs, parse: true });
}

/**
 * Pulls the two values SABR needs out of a player response, deciphering the streaming URL.
 */
async function resolveStreamingConfig(innertube: Innertube, playerResponse: IPlayerResponse) {
  const serverAbrStreamingUrl = playerResponse.streaming_data?.server_abr_streaming_url;

  return {
    serverAbrStreamingUrl: serverAbrStreamingUrl ? await innertube.session.player?.decipher(serverAbrStreamingUrl) : undefined,
    videoPlaybackUstreamerConfig: playerResponse.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config,
  };
}
