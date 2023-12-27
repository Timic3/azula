import { EmbedBuilder, WebhookClient } from 'discord.js';

export default class MonitoringUtils {
  static async logError(error: Error) {
    if (process.env.NODE_ENV !== 'production') return;

    const webhook = new WebhookClient({ id: process.env.MONITORING_WEBHOOK_ID as string, token: process.env.MONITORING_WEBHOOK_TOKEN as string });

    const description = `
      **Message**: \`${error.message}\`

      **Stack trace**: \`\`\`${error.stack}\`\`\`
`;

    const embed = new EmbedBuilder()
      .setTitle(`Uncaught exception (\`${error.name}\`)`)
      .setColor(0xFF0000)
      .setDescription(description);

    webhook
      .send({
        embeds: [embed],
      })
      .catch(console.error);
  }
}