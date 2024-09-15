import { ApplyOptions } from '@sapphire/decorators';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { youtube } from '#services/stream/youtubei';

@ApplyOptions<Command.Options>({
  description: 'Authenticate with YouTube OAuth.',
})
export class AuthCommand extends Command {
  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description),
      {
        idHints: ['1284903972561358910'],
      }
    );
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    youtube.session.once('auth-pending', async (data) => {
      await interaction.reply({ content: `Go to ${data.verification_url} in your browser and enter code ${data.user_code} to authenticate.`, ephemeral: true });
    });

    youtube.session.once('auth', async ({ credentials }) => {
      await interaction.followUp({ content: `Signed in successfully!\n\`\`\`${JSON.stringify(credentials, null, 4)}\`\`\``, ephemeral: true });
    });

    await youtube.session.signIn();

    await youtube.session.oauth.cacheCredentials();

    if (interaction.replied) {
      await interaction.followUp({ content: `Signed in successfully!` });
    } else {
      await interaction.reply({ content: `Signed in successfully!` });
    }
  }
}
