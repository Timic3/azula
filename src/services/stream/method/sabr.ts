import Innertube, { Constants, IPlayerResponse, Platform, Types, UniversalCache, YTNodes } from 'youtubei.js';
import { SabrStream } from 'googlevideo/sabr-stream';
import { buildSabrFormat, EnabledTrackTypes } from 'googlevideo/utils';
import { ReloadPlaybackContext } from 'googlevideo/protos';
import BG, { buildURL, GOOG_API_KEY, USER_AGENT, WebPoSignalOutput } from 'bgutils-js';
import { JSDOM } from 'jsdom';

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

export async function createSabrStream(
  videoId: string
): Promise<{
  audioStream: ReadableStream<Uint8Array<ArrayBufferLike>>
}> {
  const innertube = await Innertube.create({ cache: new UniversalCache(true) });
  const webPoTokenResult = await generatePoToken(videoId);

  // Get video metadata.
  const playerResponse = await makePlayerRequest(innertube, videoId);
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
  const serverAbrStreamingUrl = await innertube.session.player?.decipher(playerResponse.streaming_data?.server_abr_streaming_url);
  const videoPlaybackUstreamerConfig = playerResponse.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;

  if (!videoPlaybackUstreamerConfig) throw new Error('ustreamerConfig not found');
  if (!serverAbrStreamingUrl) throw new Error('serverAbrStreamingUrl not found');

  const sabrFormats = playerResponse.streaming_data?.adaptive_formats.map(buildSabrFormat) || [];

  const serverAbrStream = new SabrStream({
    formats: sabrFormats,
    serverAbrStreamingUrl,
    videoPlaybackUstreamerConfig,
    poToken: webPoTokenResult,
    clientInfo: {
      clientName: parseInt(Constants.CLIENT_NAME_IDS[innertube.session.context.client.clientName as keyof typeof Constants.CLIENT_NAME_IDS]),
      clientVersion: innertube.session.context.client.clientVersion,
    },
  });

  // Handle player response reload events (e.g, when IP changes, or formats expire).
  serverAbrStream.on('reloadPlayerResponse', async (reloadPlaybackContext) => {
    const playerResponse = await makePlayerRequest(innertube, videoId, reloadPlaybackContext);

    const serverAbrStreamingUrl = await innertube.session.player?.decipher(playerResponse.streaming_data?.server_abr_streaming_url);
    const videoPlaybackUstreamerConfig = playerResponse.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;

    if (serverAbrStreamingUrl && videoPlaybackUstreamerConfig) {
      serverAbrStream.setStreamingURL(serverAbrStreamingUrl);
      serverAbrStream.setUstreamerConfig(videoPlaybackUstreamerConfig);
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { videoStream, audioStream, selectedFormats } = await serverAbrStream.start({
    preferOpus: true,
    enabledTrackTypes: EnabledTrackTypes.AUDIO_ONLY,
  });

  return {
    audioStream: audioStream,
  };
}

export async function makePlayerRequest(innertube: Innertube, videoId: string, reloadPlaybackContext?: ReloadPlaybackContext): Promise<IPlayerResponse> {
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

  if (reloadPlaybackContext) {
    extraArgs.playbackContext.reloadPlaybackContext = reloadPlaybackContext;
  }

  return await watchEndpoint.call<IPlayerResponse>(innertube.actions, { ...extraArgs, parse: true });
}

const userAgent = USER_AGENT;

export async function generatePoToken(videoId: string) {
    // @NOTE: Session cache is disabled so we can get a fresh visitor data string.
    const innertube = await Innertube.create({ user_agent: userAgent, enable_session_cache: false });
    // const visitorData = innertube.session.context.client.visitorData || '';

    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>', {
        url: 'https://www.youtube.com/',
        referrer: 'https://www.youtube.com/',
        resources: { userAgent },
        beforeParse(window) {
          window.HTMLCanvasElement.prototype.getContext = () => null;
        },
    });

    Object.assign(globalThis, {
        window: dom.window,
        document: dom.window.document,
        location: dom.window.location,
        origin: dom.window.origin,
    });

    if (!Reflect.has(globalThis, 'navigator')) {
        Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator });
    }

    const challengeResponse = await innertube.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');
    if (!challengeResponse.bg_challenge)
        throw new Error('Could not get challenge');

    const interpreterUrl = challengeResponse.bg_challenge.interpreter_url.private_do_not_access_or_else_trusted_resource_url_wrapped_value;
    const bgScriptResponse = await fetch(`https:${interpreterUrl}`);
    const interpreterJavascript = await bgScriptResponse.text();

    if (interpreterJavascript) {
        new Function(interpreterJavascript)();
    } else throw new Error('Could not load VM');

    const botguard = await BG.BotGuardClient.create({
        program: challengeResponse.bg_challenge.program,
        globalName: challengeResponse.bg_challenge.global_name,
        globalObj: globalThis,
    });

    const webPoSignalOutput: WebPoSignalOutput = [];
    const botguardResponse = await botguard.snapshot({ webPoSignalOutput });
    const requestKey = 'O43z0dpjhgX20SCx4KAo';

    const integrityTokenResponse = await fetch(buildURL('GenerateIT', true), {
        method: 'POST',
        headers: {
            'content-type': 'application/json+protobuf',
            'x-goog-api-key': GOOG_API_KEY,
            'x-user-agent': 'grpc-web-javascript/0.1',
            'user-agent': userAgent,
        },
        body: JSON.stringify([ requestKey, botguardResponse ]),
    });

    const response = await integrityTokenResponse.json();

    if (typeof response[0] !== 'string')
        throw new Error('Could not get integrity token');

    const integrityTokenBasedMinter = await BG.WebPoMinter.create({ integrityToken: response[0] }, webPoSignalOutput);

    const contentPoToken = await integrityTokenBasedMinter.mintAsWebsafeString(videoId);
    // const sessionPoToken = await integrityTokenBasedMinter.mintAsWebsafeString(visitorData);

    return contentPoToken;
}
