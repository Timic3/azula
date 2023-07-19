import { ProviderSearchItem, ProviderSearchList } from '#/services/providers/AbstractProvider';
import { ApplyOptions } from '@sapphire/decorators';
import { Args, ChatInputCommand, Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, GuildMember, Message, VoiceBasedChannel } from 'discord.js';

@ApplyOptions<Command.Options>({
  aliases: ['p', 'pl'],
  flags: ['s', 'shuffle'],
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
        )
        .addBooleanOption((option) =>
          option
          .setName('shuffle')
          .setDescription('Shuffles the enqueued playlist.')
          .setRequired(false)
        ),
      {
        idHints: ['985329784139690047'],
      }
    );
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply();
    const voiceChannel = (interaction.member as GuildMember).voice.channel as VoiceBasedChannel;
    const shouldShuffle = interaction.options.getBoolean('shuffle', false) || false;
    this.handle(interaction, voiceChannel, interaction.options.getString('query', true), shouldShuffle);
  }

  public async messageRun(message: Message, args: Args) {
    const voiceChannel = message.member?.voice.channel as VoiceBasedChannel;
    const shouldShuffle = args.getFlags('s', 'shuffle');
    this.handle(message, voiceChannel, await args.rest('string'), shouldShuffle);
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

  public async handle(context: Message | Command.ChatInputCommandInteraction, voiceChannel: VoiceBasedChannel, query: string, shuffle: boolean) {
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
      
      let playlist = list.items;
      if (shuffle) {
        const shuffledItems = await this.container.queueManager.shuffle(voiceChannel, list.items);
        if (shuffledItems instanceof Array) {
          playlist = shuffledItems;
        } else {
          throw new Error("shuffledItems should not be an instance of BaseQueue.");
        }
        this.reply(context, `Enqueuing \`${list.items.length}\` items. The playlist was shuffled.`);
      } else {
        this.reply(context, `Enqueuing \`${list.items.length}\` items.`);
      }

      for (const item of playlist) {
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
