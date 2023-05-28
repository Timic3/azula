import BaseQueue from '#/services/queue/BaseQueue';
import { ApplyOptions } from '@sapphire/decorators';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, GuildMember, Message, VoiceBasedChannel, EmbedBuilder } from 'discord.js';

@ApplyOptions<Command.Options>({
  aliases: ['shuffle'],
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
        idHints: ['247468218264236471'],
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
    const queue = await this.container.queueManager.shuffle(voiceChannel);
    if (queue instanceof Array<any>) {
      throw new Error("Queue should not be and instance of Array<any>.")
    } else {
      const queueEmbed = this.container.queueManager.buildQueueEmbed(queue)
      queueEmbed && queue.current ? context.reply({ content: `Shuffled the current playlist.`, embeds: [queueEmbed] }) : context.reply({ content: `The queue is empty.` });
    }
  }
}
