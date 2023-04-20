import { AllFlowsPrecondition } from '@sapphire/framework';
import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, Message } from 'discord.js';

export class OwnerOnlyPrecondition extends AllFlowsPrecondition {
  public override async messageRun(message: Message) {
    return this.checkOwnerOnly(message.author.id);
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    return this.checkOwnerOnly(interaction.user.id);
  }

  public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
    return this.checkOwnerOnly(interaction.user.id);
  }

  private async checkOwnerOnly(userId: string) {
    return userId === process.env.BOT_OWNER ? this.ok() : this.error({ message: 'This command can only be used by bot owners!' });
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    OwnerOnly: never;
  }
}
