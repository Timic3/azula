import { ProviderSearchItem, ProviderSearchList } from '#/services/providers/AbstractProvider';
import { ApplyOptions } from '@sapphire/decorators';
import { Args, ChatInputCommand, Command, PieceContext } from '@sapphire/framework';
import { ChatInputCommandInteraction, GuildMember, Message, VoiceBasedChannel } from 'discord.js';

@ApplyOptions<Command.Options>({
  aliases: ['r', 'remove'],
  description: 'Remove a song from the queue.',
  preconditions: ['InsideVoiceChannel'],
})
export class PlayCommand extends Command {
  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addIntegerOption((option) =>
          option
            .setName('position')
            .setDescription('Remove a song at a specific position.')
            .setRequired(true)
        ),
      {
        idHints: ['236862531575356792'],
      }
    );
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply();
    const voiceChannel = (interaction.member as GuildMember).voice.channel as VoiceBasedChannel;
    this.handle(interaction, voiceChannel, interaction.options.getInteger('index', true));
  }

  public async messageRun(message: Message, args: Args) {
    const voiceChannel = message.member?.voice.channel as VoiceBasedChannel;
    this.handle(message, voiceChannel, await args.rest('number'));
  }

  public async handle(context: Message | Command.ChatInputCommandInteraction, voiceChannel: VoiceBasedChannel, position: number) {
    const queue = await this.container.queueManager.create(voiceChannel)
    if (position === 0) {
      const [skipped, current] = await this.container.queueManager.skip(voiceChannel);

      if (!skipped) {
        return context.reply({ content: 'The queue is empty.' });
      }
  
      current ? 
      context.reply({ content: `Skipped \`${skipped.title}\`.\nI am now playing \`${current.title}\`.` }) :
      context.reply({ content: `Skipped \`${skipped.title}\`.\nThe queue is empty.` });
    } else {
      const removed = queue.remove(position - 1)
      this.reply(context, removed ? `Removed \`${removed.title}\` on the position \`${position}\`.` : 'The provided position is not allowed (out of bounds).')
    }
  }

  private async reply(context: Message | ChatInputCommandInteraction, content: string) {
    if (context instanceof ChatInputCommandInteraction) {
      // We need to edit reply, because we defer it above
      return context.editReply({ content });
    } else {
      return context.reply({ content });
    }
  }
}
