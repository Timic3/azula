import { VoiceBasedChannel } from 'discord.js';
import { getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { container } from '@sapphire/framework';

import GuildIdResolver from '#services/resolvers/GuildIdResolver';
import Voice from '#services/voice/Voice';

export default class VoiceManager extends GuildIdResolver<Voice> {
  join(voiceChannel: VoiceBasedChannel) {
    const voice = this.get(voiceChannel.guildId);
    if (voice) return voice.join(voiceChannel);

    return this.create(voiceChannel);
  }

  leave(guildId: string) {
    container.queueManager.delete(guildId);

    const voice = this.get(guildId);
    if (voice) return voice.leave();

    // We might have a rogue connection, lets terminate it
    const voiceConnection = getVoiceConnection(guildId, 'AZULA_DEFAULT');
    if (voiceConnection && voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) voiceConnection.destroy();
  }

  private async create(voiceChannel: VoiceBasedChannel): Promise<Voice> {
    const newVoice = new Voice(this, voiceChannel);

    this.add(voiceChannel.guildId, newVoice);

    return newVoice.join();
  }
}
