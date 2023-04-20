import '@sapphire/plugin-logger/register';
import '@sapphire/plugin-api/register';

import VoiceManager from '#/services/voice/VoiceManager';
import AbstractProvider from '#/services/providers/AbstractProvider';
import QueueManager from '#/services/queue/QueueManager';
import { Collection } from 'discord.js';

declare module '@sapphire/pieces' {
  interface Container {
    voiceManager: VoiceManager;
    queueManager: QueueManager;
    provider: AbstractProvider;
    cache: Collection<string, any>;
  }
}
