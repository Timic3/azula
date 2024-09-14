import { container, LogLevel, SapphireClient } from '@sapphire/framework';
import { Collection, GatewayIntentBits } from 'discord.js';

import VoiceManager from '#services/voice/VoiceManager';
import QueueManager from '#services/queue/QueueManager';
import YouTubeScrapedV2Provider from '#services/providers/youtube/YouTubeScrapedV2Provider';

export default class AzulaClient extends SapphireClient {
  public constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      defaultPrefix: process.env.NODE_ENV === 'production' ? 'kek' : 'ckek',
      shards: 'auto',
      logger: {
        level: LogLevel.Debug,
      },
      caseInsensitiveCommands: true,
      loadMessageCommandListeners: true,
    });

    container.voiceManager = new VoiceManager();
    container.queueManager = new QueueManager();
    container.provider = new YouTubeScrapedV2Provider(process.env.YOUTUBE_API_KEY as string);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    container.cache = new Collection<string, any>();
  }
}
