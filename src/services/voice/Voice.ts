import { AudioPlayer, AudioPlayerState, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, DiscordGatewayAdapterCreator, entersState, joinVoiceChannel, NoSubscriberBehavior, VoiceConnection, VoiceConnectionDisconnectReason, VoiceConnectionStatus } from '@discordjs/voice';
import { container } from '@sapphire/framework';
import { VoiceBasedChannel } from 'discord.js';
import { EventEmitter } from 'node:events';
import { setTimeout as wait } from 'node:timers/promises';
// import { Readable } from 'node:stream';
// import ytdl from '@distube/ytdl-core';
// import play from 'play-dl';

import VoiceManager from './VoiceManager';
import { getAudioReadableStream, getVideoIdFromUrl } from '../stream/youtubei.js';

export default class Voice extends EventEmitter {
  private readonly voiceManager: VoiceManager;
  private voiceConnection: VoiceConnection;

  private voiceChannel: VoiceBasedChannel;
  private audioPlayer: AudioPlayer;
  private audioResource?: AudioResource;

  private readyLock: boolean = false;

  constructor(voiceManager: VoiceManager, voiceChannel: VoiceBasedChannel) {
    super();
    this.voiceManager = voiceManager;
    this.voiceConnection = this.createVoiceConnection(voiceChannel);

    this.voiceChannel = voiceChannel;
    this.audioPlayer = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });

    this.voiceConnection.on('stateChange', async (oldState, newState) => {
      container.logger.info('Connection entering state from', oldState.status, 'to', newState.status);
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
          try {
            await entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5e3);
          } catch {
            console.error('(VC001) Voice connection failed!');
            this.leave();
          }
        } else if (this.voiceConnection.rejoinAttempts < 5) {
          await wait((this.voiceConnection.rejoinAttempts + 1) * 5e3);
          this.voiceConnection.rejoin();
        } else {
          console.error('(VC002) Voice connection failed!');
          this.leave();
        }
      } else if (newState.status === VoiceConnectionStatus.Destroyed) {
        this.audioPlayer.stop(true);
      } else if (!this.readyLock && (newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling)) {
        this.readyLock = true;
        try {
          await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 20e3);
        } catch {
          this.leave();
        } finally {
          this.readyLock = false;
        }
      }
    });

    this.voiceConnection.on('error', console.error);

    this.audioPlayer.on('stateChange', (oldState, newState) => {
      container.logger.info('Player entering state from', oldState.status, 'to', newState.status);
      if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
        // TODO: This is ugly
        const queue = container.queueManager.get(this.voiceChannel.guildId);
        if (queue) {
          queue.current = null;
          queue.process();
        }
      }
    });

    this.audioPlayer.on('error', console.error);

    this.voiceConnection.subscribe(this.audioPlayer);
  }

  public async join(voiceChannel?: VoiceBasedChannel): Promise<Voice> {
    // Join another voice channel if needed
    if (voiceChannel) this.setVoiceChannel(voiceChannel);

    try {
      await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 20e3);
    } catch {
      if (this.voiceConnection.state.status === VoiceConnectionStatus.Ready) return this;
      if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) this.voiceConnection.destroy();
      this.voiceManager.delete(this.voiceChannel.guildId);
      throw new Error('VOICE_CONNECTION_FAILED');
    }

    return this;
  }

  public async leave() {
    this.audioPlayer.stop(true);
    if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) this.voiceConnection.destroy();
    this.voiceManager.delete(this.voiceChannel.guildId);
  }

  public async play(url: string) {
    /** Youtubei.js */
    const videoId = getVideoIdFromUrl(url);
    if (!videoId) throw new Error('VIDEO_ID_NOT_FOUND');

    const source = await getAudioReadableStream(videoId);
    this.audioResource = createAudioResource(source);

    /** YTDL */
    /*
    const source = ytdl(url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
      agent: this.ytdlAgent ?? undefined,
    });
    this.audioResource = createAudioResource(source);
    */

    /** PLAY-DL */
    /*
    const stream = await play.stream(url);
    this.audioResource = createAudioResource(stream.stream, {
      inputType: stream.type,
    });
    */
    this.audioPlayer.play(this.audioResource);
  }

  public async pause() {
    if (this.audioPlayer?.state?.status === AudioPlayerStatus.Playing) {
      this.audioPlayer.pause();
    } else if (this.audioPlayer?.state?.status === AudioPlayerStatus.Paused) {
      this.audioPlayer.unpause();
    }
    return this.audioPlayer?.state?.status;
  }

  public async stop() {
    return this.audioPlayer.stop(true);
  }

  public getPlaybackDuration(): number {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) return this.audioPlayer.state.resource.playbackDuration || 0;
    return 0;
  }

  public getCurrentState(): AudioPlayerState {
    return this.audioPlayer?.state;
  }

  private setVoiceChannel(voiceChannel: VoiceBasedChannel) {
    if (voiceChannel.id === this.voiceChannel.id) return;
    // Subscription to existing audio player might be handled internally by @discordjs/voice? Research.
    this.voiceConnection = this.createVoiceConnection(voiceChannel);
    this.voiceChannel = voiceChannel;
  }

  private createVoiceConnection(voiceChannel: VoiceBasedChannel): VoiceConnection {
    return joinVoiceChannel({
      channelId: voiceChannel.id as string,
      guildId: voiceChannel.guildId as string,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
      selfDeaf: true,
      selfMute: false,
      group: 'AZULA_DEFAULT',
    });
  }
}
