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
import { isCorsOriginAllowed, parseCorsOrigins } from './utils/cors';

dotenv.config();

export function buildApp() {
  const app = Fastify({ logger: true });

  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = new Set(parseCorsOrigins(process.env.CORS_ORIGINS));
  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';

  if (!jwtSecret && isProduction) {
    throw new Error('JWT_SECRET is required in production');
  }

  if (!jwtSecret && !isProduction) {
    app.log.warn('JWT_SECRET is not set; using development fallback secret');
  }

  app.register(cors, {
    origin: (origin, callback) => {
      if (isCorsOriginAllowed(origin, allowedOrigins, isProduction)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'), false);
    }
  });
  app.register(jwt, {
    secret: jwtSecret || 'dev-secret',
    sign: { expiresIn: jwtExpiresIn }
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
