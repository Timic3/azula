import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, DiscordGatewayAdapterCreator, entersState, joinVoiceChannel, StreamType, VoiceConnection, VoiceConnectionDisconnectReason, VoiceConnectionStatus } from '@discordjs/voice';
import { container } from '@sapphire/framework';
import { VoiceBasedChannel } from 'discord.js';
import { EventEmitter } from 'node:events';
import { setTimeout as wait } from 'node:timers/promises';
import { Readable } from 'node:stream';
import play from '#services/stream/ytdl';

import VoiceManager from './VoiceManager';

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
    this.audioPlayer = createAudioPlayer();

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
    const source = await play(url, {
      filter: 'audioonly',
      highWaterMark: 1 << 25,
    });
    this.audioResource = createAudioResource(source as unknown as Readable, {
      inputType: StreamType.Opus,
    });
    this.audioPlayer.play(this.audioResource);
  }

  public async pause() {
    this.audioPlayer.pause();
  }

  public async unpause() {
    this.audioPlayer.unpause();
  }

  public async stop() {
    this.audioPlayer.stop(true)
  }

  private setVoiceChannel(voiceChannel: VoiceBasedChannel) {
    if (voiceChannel.id === this.voiceChannel.id) return;
    // Subscription to existing audio player might be handled internally by @discordjs/voice? Research.
    this.voiceConnection = this.createVoiceConnection(voiceChannel);
    this.voiceChannel = voiceChannel;
  }

  private createVoiceConnection(voiceChannel: VoiceBasedChannel): VoiceConnection {
    return joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
      selfDeaf: true,
      selfMute: false,
      group: 'AZULA_DEFAULT',
    });
  }
}
