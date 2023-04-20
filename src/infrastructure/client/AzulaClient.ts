import { container, LogLevel, SapphireClient } from '@sapphire/framework';
import { Collection, GatewayIntentBits } from 'discord.js';

import VoiceManager from '#services/voice/VoiceManager';
import QueueManager from '#services/queue/QueueManager';
import YouTubeApiProvider from '#services/providers/youtube/YouTubeApiProvider';
import YouTubeScrapedProvider from '#services/providers/youtube/YouTubeScrapedProvider';

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
    container.provider = new YouTubeScrapedProvider(process.env.YOUTUBE_API_KEY as string);
    container.cache = new Collection<string, any>();
  }
}
