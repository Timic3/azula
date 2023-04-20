import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { StringSelectMenuInteraction } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.SelectMenu
})
export class SearchInteractionHandler extends InteractionHandler {
  public override parse(interaction: StringSelectMenuInteraction) {
    if (interaction.customId !== 'search-song') return this.none();

    return this.some();
  }

  public async run(interaction: StringSelectMenuInteraction) {
    await interaction.reply({
      content: `You have selected ${interaction.values[0]}.`,
    });
  }
}
