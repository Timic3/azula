import { ApplyOptions } from '@sapphire/decorators';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { GuildMember, Message, VoiceBasedChannel } from 'discord.js';

@ApplyOptions<Command.Options>({
  description: 'Disconnect the bot from current voice channel.',
  preconditions: ['InsideVoiceChannel'],
})
export class LeaveCommand extends Command {
  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description),
      {
        idHints: ['1084162040597315594'],
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
    if (!voiceChannel.members.get(context.client.user.id)) {
      context.reply({ content: `:diamonds: **I am not inside this voice channel!**`, ephemeral: true });
      return;
    }

    await this.container.voiceManager.leave(voiceChannel.guildId);

    // TODO: We should move this somewhere else - preferably on an emitter/listener
    this.container.client.user?.setPresence({
      activities: [],
    });

    context.reply({ content: `:link: **I have disconnected from the voice channel.**` });
  }
}
