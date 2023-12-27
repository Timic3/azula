import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, MessageCommandDeniedPayload, UserError } from '@sapphire/framework';

import MonitoringUtils from '#utils/MonitoringUtils';

@ApplyOptions<Listener.Options>({ event: Events.MessageCommandError })
export class MessageCommandDeniedListener extends Listener {
  public run(error: UserError, payload: MessageCommandDeniedPayload) {
    const message = payload.message;

    MonitoringUtils.logError(error);

    return message.reply({
      content: `:diamonds: **Whoops! An unexpected error has occurred!**`,
      allowedMentions: {
        users: [message.author.id],
      },
    });
  }
}
