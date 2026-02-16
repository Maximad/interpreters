import { buildApp } from './app';
import { prisma } from './plugins/prisma';
import { processNotificationQueue } from './routes/notifications';
import { syncApprovedInterpreterProfiles } from './utils/search-index';

const port = Number(process.env.PORT || 4000);
const host = '0.0.0.0';

const app = buildApp();

app
  .listen({ port, host })
  .then(() => {
    const syncMs = Number(process.env.SEARCH_SYNC_INTERVAL_MS || 30000);
    setInterval(async () => {
      try {
        await syncApprovedInterpreterProfiles(prisma, app.meiliClient, app.meiliIndexName);
        app.log.info('Periodic search index sync completed');
      } catch (error) {
        app.log.error(error, 'Periodic search index sync failed');
      }
    }, syncMs);

    const notifyMs = Number(process.env.NOTIFICATION_QUEUE_INTERVAL_MS || 10000);
    setInterval(async () => {
      try {
        await processNotificationQueue();
      } catch (error) {
        app.log.error(error, 'Notification queue processing failed');
      }
    }, notifyMs);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
