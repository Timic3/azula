import { ApplyOptions } from '@sapphire/decorators';
import { ChatInputCommandDeniedPayload, Events, Listener, UserError } from '@sapphire/framework';

import MonitoringUtils from '#utils/MonitoringUtils';

@ApplyOptions<Listener.Options>({ event: Events.ChatInputCommandError })
export class ChatInputCommandDeniedListener extends Listener {
  public run(error: UserError, payload: ChatInputCommandDeniedPayload) {
    const interaction = payload.interaction;

    MonitoringUtils.logError(error);

    return interaction.reply({
      content: `:diamonds: **Whoops! An unexpected error has occurred!**`,
      allowedMentions: {
        users: [interaction.user.id],
      },
      ephemeral: true,
    });
  }
}
