// TODO: Improve this whole mess. It's also probably very slow.

import ytdl, { videoFormat } from "ytdl-core";
import prism from 'prism-media';

import { pipeline, Readable } from 'node:stream';

function opusFilter(format: videoFormat) {
  return format.codecs === 'opus' &&
    format.container === 'webm' &&
    format.audioSampleRate === '48000';
}

function nextBestFormat(formats: videoFormat[], isLive: boolean) {
  let filter = (format: videoFormat) => format.audioBitrate !== undefined;

	if (isLive) {
    filter = (format: videoFormat) => format.audioBitrate !== undefined && format.isHLS;
  }

	formats = formats
		.filter(filter)
		.sort((a: videoFormat, b: videoFormat) => (b.audioBitrate as number) - (a.audioBitrate as number));

	return formats.find(format => !format.bitrate) || formats[0];
}

const noop = () => {};

async function stream(link: string, options: ytdl.downloadOptions) {
  const info = await ytdl.getInfo(link);

  const format = info.formats.find(opusFilter);
  const canDemux = format && info.videoDetails.lengthSeconds !== '0';
  if (canDemux) {
    options = { ...options, filter: opusFilter };
  } else if (info.videoDetails.lengthSeconds !== '0') {
    options = { ...options, filter: 'audioonly' };
  }

  if (canDemux) {
    const demuxer = new prism.opus.WebmDemuxer();
    return pipeline([
      ytdl.downloadFromInfo(info, options),
      demuxer,
    ], noop);
  } else {
    const bestFormat = nextBestFormat(info.formats, info.videoDetails.isLiveContent);
    if (!bestFormat) throw new Error('No suitable format found');
    const transcoder = new prism.FFmpeg({
      args: [
				'-reconnect', '1',
				'-reconnect_streamed', '1',
				'-reconnect_delay_max', '5',
				'-i', bestFormat.url,
				'-analyzeduration', '0',
				'-loglevel', '0',
				'-f', 's16le',
				'-ar', '48000',
				'-ac', '2',
      ],
      shell: false,
    });
    const opus = new prism.opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 });
    return pipeline([transcoder, opus], noop);
  }
}

export default Object.assign(stream, ytdl);
