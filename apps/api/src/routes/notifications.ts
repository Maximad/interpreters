import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma';
import { emailConfigured, sendEmail } from '../utils/email';

const emailPayload = z.object({ subject: z.string(), body: z.string() });

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/dashboard/notifications', { preHandler: app.authenticate }, async (request) => {
    return prisma.notification.findMany({
      where: { user_id: request.user.sub },
      orderBy: { created_at: 'desc' },
      take: 100
    });
  });

  app.post('/dashboard/notifications/:id/read', { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = z.object({ id: z.string().cuid() }).safeParse(request.params);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const item = await prisma.notification.findFirst({
      where: { id: parsed.data.id, user_id: request.user.sub }
    });
    if (!item) return reply.status(404).send({ message: 'Notification not found' });

    return prisma.notification.update({ where: { id: item.id }, data: { is_read: true } });
  });
};

export async function processNotificationQueue() {
  const pending = await prisma.notification.findMany({
    where: emailConfigured() ? { status: 'PENDING' } : { status: 'PENDING', channel: 'DASHBOARD' },
    orderBy: { created_at: 'asc' },
    take: Number(process.env.NOTIFICATION_BATCH_SIZE || 50),
    include: { user: { select: { email: true } } }
  });

  for (const item of pending) {
    try {
      if (item.channel === 'EMAIL') {
        const { subject, body } = emailPayload.parse(item.payload);
        await sendEmail(item.user.email, subject, body);
      }
      await prisma.notification.update({
        where: { id: item.id },
        data: { status: 'SENT', sent_at: new Date() }
      });
    } catch {
      await prisma.notification.update({ where: { id: item.id }, data: { status: 'FAILED' } });
    }
  }
}
