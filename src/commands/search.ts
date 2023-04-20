import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import { ActionRowBuilder, EmbedBuilder, Message, StringSelectMenuBuilder } from 'discord.js';

import DurationUtils from '#utils/DurationUtils';
import { ProviderSearchList } from '#/services/providers/AbstractProvider';

@ApplyOptions<Command.Options>({
  description: 'Search on YouTube.',
})
export class SearchCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) => 
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) => 
          option
            .setName('query')
            .setDescription('Query string which you want to search with.')
            .setRequired(true)
        ),
      {
        idHints: ['983125581140992051']
      }
    )
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const query = interaction.options.getString('query', true);
    const result: ProviderSearchList = await this.container.provider.search(query);

    const selectionRow = new ActionRowBuilder<StringSelectMenuBuilder>()
      .setComponents(
        new StringSelectMenuBuilder()
          .setCustomId('search-song')
          .setPlaceholder('Choose a song...')
          .addOptions(
            result.items.map((item) => ({
              label: item.title,
              description: item.author.title,
              value: item.sourceUrl,
            }))
          )
      );

    await interaction.editReply({
      content: `:small_blue_diamond: I have compiled a list of songs according to your query \`${query}\`.`,
      components: [selectionRow],
    });
  }

  public async messageRun(message: Message, args: Args) {
    try {
      const text = await (args.rest('string'));
      const result: ProviderSearchList = await this.container.provider.search(text);

      if (result.items.length !== 0) {
        const item = result.items[0];

        const embed = new EmbedBuilder()
          .setColor('#c0edff')
          .setTitle(item.title)
          .setURL(item.sourceUrl)
          .setAuthor({
            name: item.author.title,
            url: item.author.profileUrl,
          })
          .setDescription(item.description);

        if (item.thumbnailUrl) {
          embed.setThumbnail(item.thumbnailUrl);
        }

        if (item.duration) {
          embed.addFields({
            name: 'Duration',
            value: DurationUtils.humanizeDuration(item.duration),
            inline: true
          });
        }

        if (item.publishedAt) {
          embed.setTimestamp(item.publishedAt);
        }

        message.reply({ embeds: [ embed ] })
      } else {
        message.reply(':diamonds: **I could not find any video with that name, sorry!**');
      }
    } catch (e) {
      console.error(e);
      message.reply('**An unexpected API error has occurred.**');
    }
  }
}
