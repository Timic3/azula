import '#infrastructure/setup';

import AzulaClient from '#infrastructure/client/AzulaClient';
import MonitoringUtils from '#utils/MonitoringUtils';

const client = new AzulaClient();

try {
  await client.login(process.env.DISCORD_TOKEN);
  client.logger.info(`Bot successfully logged in as ${client.user?.username}.`);
} catch (error) {
  client.logger.fatal(error);
  client.destroy();
  MonitoringUtils.logError(error as Error);
  process.exitCode = 1; // Keep event loop clean and exit gracefully
}
