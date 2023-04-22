import { ApplyOptions } from '@sapphire/decorators';
import { Args, ChatInputCommand, Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, GuildMember, Message, VoiceBasedChannel } from 'discord.js';

@ApplyOptions<Command.Options>({
  aliases: ['s', 'skip'],
  description: 'Skip the current song.',
  preconditions: ['InsideVoiceChannel'],
})
export class PlayCommand extends Command {
  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description),
      {
        idHints: ['653221772374673210'],
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

  public async handle(context: Message | Command.ChatInputCommandInteraction, voiceChannel: VoiceBasedChannel) {    
    const [skipped, current] = await this.container.queueManager.skip(voiceChannel);

    if (context instanceof ChatInputCommandInteraction) {
      if (!skipped) {
        return context.editReply({ content: 'The queue is empty.' });
      }

      current ? 
      context.editReply({ content: `Skipped \`${skipped.title}\`.\nI am now playing \`${current.title}\`.` }) :
      context.editReply({ content: `Skipped \`${skipped.title}\`.\nThe queue is empty.` });
    } else {
      if (!skipped) {
        return context.reply({ content: 'The queue is empty.' });
      }

      current ? 
      context.reply({ content: `Skipped \`${skipped.title}\`.\nI am now playing \`${current.title}\`.` }):
      context.reply({ content: `Skipped \`${skipped.title}\`.\nThe queue is empty.` });
    }
  }
}