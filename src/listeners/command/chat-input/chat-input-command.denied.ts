import { ApplyOptions } from '@sapphire/decorators';
import { ChatInputCommandDeniedPayload, Events, Listener, UserError } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({ event: Events.ChatInputCommandDenied })
export class ChatInputCommandDeniedListener extends Listener {
  public run(error: UserError, payload: ChatInputCommandDeniedPayload) {
    if (Reflect.get(Object(error.context), 'silent')) return;

    const interaction = payload.interaction;

    return interaction.reply({
      content: `:diamonds: **${error.message}**`,
      allowedMentions: {
        users: [interaction.user.id],
      },
      ephemeral: true,
    });
  }
}
