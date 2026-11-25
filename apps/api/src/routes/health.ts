import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../plugins/prisma';

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_request, reply) => {
    try {
      await Promise.all([prisma.$queryRaw`SELECT 1`, app.meiliClient.health()]);
      return { status: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
};
