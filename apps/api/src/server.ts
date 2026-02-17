import { buildApp } from './app';
import { prisma } from './plugins/prisma';
import { processNotificationQueue } from './routes/notifications';
import { syncApprovedInterpreterProfiles } from './utils/search-index';

const port = Number(process.env.PORT || 4000);
const host = '0.0.0.0';

const app = buildApp();

function startPeriodicTask(name: string, intervalMs: number, task: () => Promise<void>) {
  let running = false;

  const timer = setInterval(async () => {
    if (running) {
      app.log.warn({ task: name }, 'Skipping periodic task run because previous run is still in progress');
      return;
    }

    running = true;
    try {
      await task();
    } catch (error) {
      app.log.error(error, `${name} failed`);
    } finally {
      running = false;
    }
  }, intervalMs);

  timer.unref();
  return timer;
}

app
  .listen({ port, host })
  .then(() => {
    const syncMs = Number(process.env.SEARCH_SYNC_INTERVAL_MS || 30000);
    const notifyMs = Number(process.env.NOTIFICATION_QUEUE_INTERVAL_MS || 10000);

    const searchSyncInterval = startPeriodicTask('Periodic search index sync', syncMs, async () => {
      await syncApprovedInterpreterProfiles(prisma, app.meiliClient, app.meiliIndexName);
      app.log.info('Periodic search index sync completed');
    });

    const notificationInterval = startPeriodicTask('Notification queue processing', notifyMs, async () => {
      await processNotificationQueue();
    });

    const shutdown = async (signal: NodeJS.Signals) => {
      app.log.info({ signal }, 'Received shutdown signal');
      clearInterval(searchSyncInterval);
      clearInterval(notificationInterval);
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.once('SIGINT', () => {
      void shutdown('SIGINT');
    });

    process.once('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
