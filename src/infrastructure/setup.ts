import '@sapphire/plugin-logger/register';
import '@sapphire/plugin-api/register';

import { Collection } from 'discord.js';

import VoiceManager from '#services/voice/VoiceManager';
import AbstractProvider from '#services/providers/AbstractProvider';
import QueueManager from '#services/queue/QueueManager';
import MonitoringUtils from '#utils/MonitoringUtils';

declare module '@sapphire/pieces' {
  interface Container {
    voiceManager: VoiceManager;
    queueManager: QueueManager;
    provider: AbstractProvider;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cache: Collection<string, any>;
  }
}

process.on('uncaughtExceptionMonitor', (error: Error) => {
  MonitoringUtils.logError(error);
});

process.on('unhandledRejection', (reason: Error) => {
  MonitoringUtils.logError(reason);
  throw reason;
});
