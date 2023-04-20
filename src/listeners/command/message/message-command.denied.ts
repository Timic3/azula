import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, MessageCommandDeniedPayload, UserError } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({ event: Events.MessageCommandDenied })
export class MessageCommandDeniedListener extends Listener {
  public run(error: UserError, payload: MessageCommandDeniedPayload) {
    if (Reflect.get(Object(error.context), 'silent')) return;

    const message = payload.message;

    return message.reply({
      content: `:diamonds: **${error.message}**`,
      allowedMentions: {
        users: [message.author.id],
      },
    });
  }
}
