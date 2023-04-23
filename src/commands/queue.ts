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

    // TODO: We can add buttons to manipulate the queue (pagination, skip, etc.))
    let queueEmbed;
    if (queue.current) {
      const queueTitles = queue.queue.slice(0, 5).map((item, index) => `\`${index + 1}. ${item.title} \``);
      const itemsRemaining = (queue?.queue?.length || 0) - (queueTitles?.length || 0);
      queueEmbed = new EmbedBuilder()
        .setColor(0xE0812D)
        .addFields(
          { "name": `Current song playing:`, "value": `\`${queue.current.title}\``, "inline": true },
          { "name": `Next items in queue:`, "value": queueTitles.length ? `${queueTitles.join('\n')}` : "No further items in queue." }
        );
      if (itemsRemaining){
        queueEmbed.addFields({ "name": "\u200B", "value": `And \`${itemsRemaining}\` other items.` });
      }
    }

    if (context instanceof ChatInputCommandInteraction) {
      queueEmbed && queue.current ? context.editReply({ embeds: [queueEmbed] }) : context.editReply({ content: `The queue is empty.` });
    } else {
      queueEmbed && queue.current ? context.reply({ embeds: [queueEmbed] }) : context.reply({ content: `The queue is empty.` });
    }
  }
}
