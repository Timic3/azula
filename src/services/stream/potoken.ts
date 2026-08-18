import { BotGuardClient } from 'bgutils-js/botguard';
import { WebPoMinter } from 'bgutils-js/webpo';
import { buildURL, getHeaders, parseLooseJSON, USER_AGENT } from 'bgutils-js/utils';
import type { WebPoSignalOutput } from 'bgutils-js/shared-types';
import { JSDOM, VirtualConsole } from 'jsdom';

/**
 * Proof of Origin tokens.
 *
 * YouTube expects playback requests to carry a token proving they came from a real client.
 * Producing one means running Google's BotGuard VM against a challenge, exchanging its snapshot
 * for an integrity token, and minting from that. Attestation is slow and the resulting minter is
 * good for hours, so it is built once and shared.
 */

const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';

type BgChallengeResponse = {
  bgChallenge?: {
    program: string;
    globalName: string;
    interpreterUrl: { privateDoNotAccessOrElseTrustedResourceUrlWrappedValue: string };
  };
};

let minterPromise: Promise<WebPoMinter> | undefined;
let minterExpiresAt = 0;

/**
 * Mints a token bound to `contentBinding` - a video ID for content bound tokens, or visitor data
 * for session bound ones. Attestation is performed on first use and reused afterwards.
 */
export async function mintPoToken(contentBinding: string): Promise<string> {
  const minter = await getPoTokenMinter();
  return minter.mintAsWebsafeString(contentBinding);
}

/**
 * Drops the cached attestation so the next token is minted from a fresh challenge.
 *
 * Call this when YouTube rejects a token it should have accepted: the minter is what went stale,
 * so minting again from the same one would only produce another rejected token.
 */
export function invalidatePoTokenMinter() {
  minterPromise = undefined;
  minterExpiresAt = 0;
}

/**
 * Returns a cached minter, rebuilding it once the integrity token is close to expiring.
 *
 * The cache is checked synchronously: loading the interpreter replaces globals, so two
 * concurrent rebuilds would trample each other.
 */
function getPoTokenMinter(): Promise<WebPoMinter> {
  if (minterPromise && minterExpiresAt > Date.now())
    return minterPromise;

  // Park the deadline in the future so callers arriving mid-build wait on this attempt instead
  // of starting their own, then record the real one once the integrity token comes back.
  minterExpiresAt = Infinity;

  minterPromise = createPoTokenMinter()
    .then(({ minter, expiresAt }) => {
      minterExpiresAt = expiresAt;
      return minter;
    })
    .catch((error) => {
      invalidatePoTokenMinter();
      throw error;
    });

  return minterPromise;
}

/**
 * Builds a WebPO minter from the challenge embedded in the YouTube homepage.
 *
 * The challenge has to come from the page rather than from InnerTube's /att/get endpoint:
 * YouTube binds it to `yt.config_.EVENT_ID`, and tokens minted from an unbound challenge are
 * rejected by the SABR server, which then only serves the ~1 MB cold start allowance.
 * See https://github.com/LuanRT/BgUtils/pull/44.
 */
async function createPoTokenMinter(): Promise<{ minter: WebPoMinter, expiresAt: number }> {
  const pageResponse = await fetch('https://www.youtube.com', {
    headers: {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.7',
      'user-agent': USER_AGENT,
    },
  });

  const pageHtml = await pageResponse.text();

  const ytConfig = pageHtml.match(/ytcfg\.set\(({.+?})\);/s)?.[1];

  if (!ytConfig)
    throw new Error('Could not find ytcfg in page HTML');

  setupBotguardGlobals(JSON.parse(ytConfig));

  const initialAttestationData = pageHtml.match(/window\.ytAtN\(\s*({[\s\S]*?})\s*\)/);

  if (!initialAttestationData)
    throw new Error('Could not find challenge in page HTML');

  const challengeResponse = parseLooseJSON(initialAttestationData[1]).R as BgChallengeResponse | undefined;
  const bgChallenge = challengeResponse?.bgChallenge;

  if (!bgChallenge)
    throw new Error('Could not get challenge');

  const interpreterUrl = bgChallenge.interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;
  const bgScriptResponse = await fetch(`https:${interpreterUrl}`);
  const interpreterJavascript = await bgScriptResponse.text();

  if (interpreterJavascript) {
    new Function(interpreterJavascript)();
  } else throw new Error('Could not load VM');

  const botguard = await BotGuardClient.create({
    program: bgChallenge.program,
    globalName: bgChallenge.globalName,
    globalObject: globalThis,
  });

  const webPoSignalOutput: WebPoSignalOutput = [];
  const botguardResponse = await botguard.snapshot({ webPoSignalOutput });

  const integrityTokenResponse = await fetch(buildURL('GenerateIT', true), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify([ REQUEST_KEY, botguardResponse ]),
  });

  const [ integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken ] = await integrityTokenResponse.json() as [string, number, number, string];

  if (typeof integrityToken !== 'string')
    throw new Error('Could not get integrity token');

  const minter = await WebPoMinter.create({
    integrityToken,
    estimatedTtlSecs,
    mintRefreshThreshold,
    websafeFallbackToken,
  }, webPoSignalOutput);

  // Refresh a little before the server stops honouring the token, mirroring the web client.
  const ttlSecs = Math.max((estimatedTtlSecs || 3600) - (mintRefreshThreshold || 0), 60);

  return { minter, expiresAt: Date.now() + (ttlSecs * 1000) };
}

let botguardWindow: JSDOM['window'] | undefined;

/**
 * BotGuard expects to run in a browser, so give it one.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setupBotguardGlobals(ytConfig: Record<string, any>) {
  botguardWindow ??= new JSDOM('<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>', {
    url: 'https://www.youtube.com',
    referrer: 'https://www.youtube.com/',
    // jsdom reads the UA from `resources`, not from a top-level `userAgent` option.
    resources: { userAgent: USER_AGENT },
    // BotGuard probes APIs jsdom does not implement (canvas, etc). Those probes are expected
    // and harmless, so keep their stack traces out of the bot's logs.
    virtualConsole: new VirtualConsole().forwardTo(console, { jsdomErrors: 'none' }),
  }).window;

  // BotGuard reads EVENT_ID from here, and the challenge above is bound to it.
  const yt = { config_: ytConfig };

  Object.assign(botguardWindow, { yt });

  Object.assign(globalThis, {
    yt,
    window: botguardWindow,
    document: botguardWindow.document,
    location: botguardWindow.location,
    origin: botguardWindow.origin,
  });

  if (!('navigator' in globalThis)) {
    Object.defineProperty(globalThis, 'navigator', { value: botguardWindow.navigator });
  }
}
