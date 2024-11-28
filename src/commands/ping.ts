import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
  aliases: ['ping', 'pong'],
  description: 'Pong!',
})
export class PingCommand extends Command {
  public async messageRun(message: Message) {
    if (!message.channel.isSendable()) {
      return;
    }

    const msg = await message.channel.send(':ping_pong: Ping?');

    return msg.edit(
      `:ping_pong: Pong! Bot latency ${Math.round(this.container.client.ws.ping)}ms. API latency ${
        msg.createdTimestamp - message.createdTimestamp
      }ms.`
    );
  }
}
