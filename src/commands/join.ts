import { ApplyOptions } from '@sapphire/decorators';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { GuildMember, Message, VoiceBasedChannel } from 'discord.js';

@ApplyOptions<Command.Options>({
  description: 'Connect the bot to current voice channel.',
  preconditions: ['InsideVoiceChannel'],
})
export class JoinCommand extends Command {
  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description),
      {
        idHints: ['1084134491343290518'],
      }
    );
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const voiceChannel = (interaction.member as GuildMember).voice.channel as VoiceBasedChannel;
    this.handle(interaction, voiceChannel);
  }

  public async messageRun(message: Message) {
    const voiceChannel = message.member?.voice.channel as VoiceBasedChannel;
    this.handle(message, voiceChannel);
  }

  private async handle(context: Message | Command.ChatInputCommandInteraction, voiceChannel: VoiceBasedChannel) {
    await this.container.voiceManager.join(voiceChannel);

    context.reply({ content: `:link: **I connected to <#${voiceChannel.id}>.**` });
  }
}
