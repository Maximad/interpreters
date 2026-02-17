import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma';

const directInquirySchema = z.object({
  interpreterProfileId: z.string().cuid(),
  message: z.string().min(5),
  details: z.string().min(5).optional()
});

const DAILY_DIRECT_INQUIRY_LIMIT = Number(process.env.DAILY_DIRECT_INQUIRY_LIMIT || 30);

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const inquiryRoutes: FastifyPluginAsync = async (app) => {
  app.post('/direct-inquiries', { preHandler: app.authorize(['CLIENT']) }, async (request, reply) => {
    const parsed = directInquirySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const countToday = await prisma.directInquiry.count({
      where: { client_user_id: request.user.sub, created_at: { gte: startOfToday() } }
    });
    if (countToday >= DAILY_DIRECT_INQUIRY_LIMIT) {
      return reply.status(429).send({ message: 'Daily direct inquiry limit reached' });
    }

    const profile = await prisma.interpreterProfile.findUnique({
      where: { id: parsed.data.interpreterProfileId },
      include: { user: true }
    });

    if (!profile || profile.status !== 'APPROVED') {
      return reply.status(404).send({ message: 'Interpreter profile not available' });
    }

    const inquiry = await prisma.directInquiry.create({
      data: {
        client_user_id: request.user.sub,
        interpreter_profile_id: profile.id,
        message: parsed.data.message,
        details: parsed.data.details
      }
    });

    await prisma.notification.createMany({
      data: [
        {
          user_id: profile.user_id,
          channel: 'DASHBOARD',
          category: 'DIRECT_INQUIRY',
          payload: { inquiryId: inquiry.id, message: parsed.data.message },
          status: 'PENDING'
        },
        {
          user_id: profile.user_id,
          channel: 'EMAIL',
          category: 'DIRECT_INQUIRY',
          payload: {
            inquiryId: inquiry.id,
            subject: 'New direct inquiry',
            body: parsed.data.message
          },
          status: 'PENDING'
        }
      ]
    });

    return inquiry;
  });

  app.get('/dashboard/client/inquiries', { preHandler: app.authorize(['CLIENT']) }, async (request) => {
    return prisma.directInquiry.findMany({
      where: { client_user_id: request.user.sub },
      include: { interpreter_profile: { include: { user: { select: { full_name: true } } } } },
      orderBy: { created_at: 'desc' }
    });
  });

  app.get('/dashboard/interpreter/inquiries', { preHandler: app.authorize(['INTERPRETER']) }, async (request) => {
    const profile = await prisma.interpreterProfile.findUnique({ where: { user_id: request.user.sub } });
    if (!profile) return [];

    return prisma.directInquiry.findMany({
      where: { interpreter_profile_id: profile.id },
      include: { client: { select: { full_name: true, email: true } } },
      orderBy: { created_at: 'desc' }
    });
  });
};
