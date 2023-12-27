import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import { VoiceState } from 'discord.js';

@ApplyOptions<Listener.Options>({ event: Events.VoiceStateUpdate })
export class VoiceInactivityListener extends Listener {
  public run(oldState: VoiceState) {
    if (oldState.channelId !== oldState.guild.members.me?.voice.channelId) return;

    // Robots talking to each other with no humans present? Hell no!
    if ((oldState.channel?.members.filter(member => !member.user.bot).size) === 0) {
      const guildId = oldState.guild.id;
      this.container.voiceManager.leave(guildId);

      // TODO: We should move this somewhere else - preferably on an emitter/listener
      this.container.client.user?.setPresence({
        activities: [],
      });
    }
  }
}
