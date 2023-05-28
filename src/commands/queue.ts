import BaseQueue from '#/services/queue/BaseQueue';
import { ApplyOptions } from '@sapphire/decorators';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, GuildMember, Message, VoiceBasedChannel, EmbedBuilder } from 'discord.js';

@ApplyOptions<Command.Options>({
  aliases: ['q', 'queue'],
  description: 'Get the current queue.',
  preconditions: ['InsideVoiceChannel'],
})
export class PlayCommand extends Command {
  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description),
      {
        idHints: ['478694795454274752'],
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
    const queue = await this.container.queueManager.create(voiceChannel);
    const queueEmbed = this.container.queueManager.buildQueueEmbed(queue)

    queueEmbed && queue.current ? context.reply({ embeds: [queueEmbed] }) : context.reply({ content: `The queue is empty.` });
  }
}
