import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import authPlugin from './plugins/auth';
import meilisearchPlugin from './plugins/meilisearch';
import { prisma } from './plugins/prisma';
import { healthRoute } from './routes/health';
import { authRoutes } from './routes/auth';
import { profileRoutes } from './routes/profile';
import { searchRoutes } from './routes/search';
import { syncApprovedInterpreterProfiles } from './utils/search-index';
import { inquiryRoutes } from './routes/inquiries';
import { notificationRoutes } from './routes/notifications';
import { requestRoutes } from './routes/requests';

dotenv.config();

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret',
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    }
  });
  app.register(authPlugin);
  app.register(meilisearchPlugin);

  app.register(healthRoute);
  app.register(authRoutes, { prefix: '/api' });
  app.register(profileRoutes, { prefix: '/api' });
  app.register(searchRoutes, { prefix: '/api' });
  app.register(inquiryRoutes, { prefix: '/api' });
  app.register(requestRoutes, { prefix: '/api' });
  app.register(notificationRoutes, { prefix: '/api' });

  app.addHook('onReady', async () => {
    await syncApprovedInterpreterProfiles(prisma, app.meiliClient, app.meiliIndexName);
    app.log.info('Search index synced with approved interpreter profiles');
  });

  return app;
}
