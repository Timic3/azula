import { AllFlowsPrecondition } from '@sapphire/framework';
import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, GuildMember, Message, VoiceBasedChannel } from 'discord.js';

export class InsideVoiceChannelPrecondition extends AllFlowsPrecondition {
  public override async messageRun(message: Message) {
    return this.checkVoiceChannel(message.member?.voice.channel);
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const guildMember = interaction.member as GuildMember;
    return this.checkVoiceChannel(guildMember.voice.channel);
  }

  public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
    const guildMember = interaction.member as GuildMember;
    return this.checkVoiceChannel(guildMember.voice.channel);
  }

  private async checkVoiceChannel(voiceChannel: VoiceBasedChannel | null | undefined) {
    return voiceChannel ? this.ok() : this.error({ message: 'You must be inside a voice channel!' });
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    InsideVoiceChannel: never;
  }
}
