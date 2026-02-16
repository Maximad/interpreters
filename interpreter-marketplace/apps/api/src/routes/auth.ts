import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma';
import { hashPassword, makeToken, verifyPassword } from '../utils/security';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: z.enum(['CLIENT', 'INTERPRETER']).default('CLIENT')
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const verifyEmailSchema = z.object({
  token: z.string().min(10)
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/signup', async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { email, password, fullName, role } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.status(409).send({ message: 'Email already exists' });

    const user = await prisma.user.create({
      data: {
        email,
        full_name: fullName,
        password_hash: hashPassword(password),
        role
      }
    });

    const token = makeToken();
    await prisma.emailVerificationToken.create({
      data: {
        user_id: user.id,
        token,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24)
      }
    });

    return {
      message: 'Account created. Verify email to login.',
      verificationToken: token
    };
  });

  app.post('/auth/verify-email', async (request, reply) => {
    const parsed = verifyEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const tokenRecord = await prisma.emailVerificationToken.findUnique({ where: { token: parsed.data.token } });
    if (!tokenRecord || tokenRecord.consumed_at || tokenRecord.expires_at < new Date()) {
      return reply.status(400).send({ message: 'Invalid or expired verification token' });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: tokenRecord.user_id },
        data: { is_email_verified: true }
      }),
      prisma.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { consumed_at: new Date() }
      })
    ]);

    return { message: 'Email verified successfully' };
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !verifyPassword(password, user.password_hash)) {
      return reply.status(401).send({ message: 'Invalid credentials' });
    }

    if (!user.is_email_verified) {
      return reply.status(403).send({ message: 'Please verify your email before login' });
    }

    const token = await reply.jwtSign({ sub: user.id, role: user.role, email: user.email });
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  });
};
