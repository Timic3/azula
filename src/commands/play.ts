import { ProviderSearchItem, ProviderSearchList } from '#/services/providers/AbstractProvider';
import { ApplyOptions } from '@sapphire/decorators';
import { Args, ChatInputCommand, Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, GuildMember, Message, VoiceBasedChannel } from 'discord.js';

@ApplyOptions<Command.Options>({
  aliases: ['p', 'pl'],
  description: 'Play or add music to queue.',
  preconditions: ['InsideVoiceChannel'],
})
export class PlayCommand extends Command {
  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('Query string which you want to search with.')
            .setMinLength(1)
            .setMaxLength(100)
            .setRequired(true)
            .setAutocomplete(true)
        ),
      {
        idHints: ['985329784139690047'],
      }
    );
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply();
    const voiceChannel = (interaction.member as GuildMember).voice.channel as VoiceBasedChannel;
    this.handle(interaction, voiceChannel, interaction.options.getString('query', true));
  }

  public async messageRun(message: Message, args: Args) {
    const voiceChannel = message.member?.voice.channel as VoiceBasedChannel;
    this.handle(message, voiceChannel, await args.rest('string'));
  }

  public override async autocompleteRun(interaction: Command.AutocompleteInteraction) {
    const query = interaction.options.getString('query', true);
    if (query.length === 0) return interaction.respond([]);

    const result: string[] = await this.container.provider.suggestions(query);

    return interaction.respond(
      result.map((item) => ({
        name: item,
        value: item,
      }))
    );
  }

  public async handle(context: Message | Command.ChatInputCommandInteraction, voiceChannel: VoiceBasedChannel, query: string) {
    const result = await this.container.provider.searchOne(query);
    if (result === null) return this.reply(context, `:diamonds: **Couldn't find anything with your query.**`);

    const queue = await this.container.queueManager.create(voiceChannel);

    if (result.type === 'item') {
      const item = result.result as ProviderSearchItem;

      if (queue.queue.length === 0 && !queue.current) {
        this.reply(context, `Now playing \`${item.title}\`.`);
      } else {
        this.reply(context, `Enqueueing \`${item.title}\` at position \`${queue.queue.length + 1}\`.`);
      }

      queue.enqueue({
        artist: item.author.title,
        description: item.description,
        duration: item.duration,
        thumbnail: item.thumbnailUrl,
        title: item.title,
        url: item.sourceUrl,
      });
    } else {
      const list = result.result as ProviderSearchList;

      this.reply(context, `Enqueueing \`${list.items.length}\` items.`);

      for (const item of list.items) {
        queue.enqueue({
          artist: item.author.title,
          description: item.description,
          duration: item.duration,
          thumbnail: item.thumbnailUrl,
          title: item.title,
          url: item.sourceUrl,
        });
      }
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
