import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma';
import { hashPassword, hashToken, makeToken, verifyPassword } from '../utils/security';

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

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const authRateLimits = new Map<string, { attempts: number; resetAt: number }>();

function checkRateLimit(key: string, maxAttempts: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const current = authRateLimits.get(key);

  if (!current || current.resetAt <= now) {
    authRateLimits.set(key, { attempts: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.attempts >= maxAttempts) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  current.attempts += 1;
  authRateLimits.set(key, current);
  return { allowed: true, retryAfterSeconds: 0 };
}

function enforceAuthRateLimit(
  requestIp: string,
  route: 'signup' | 'login' | 'verify-email'
): RateLimitResult {
  const limits = {
    signup: { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
    login: { maxAttempts: 20, windowMs: 15 * 60 * 1000 },
    'verify-email': { maxAttempts: 30, windowMs: 15 * 60 * 1000 }
  } as const;

  const selected = limits[route];
  return checkRateLimit(`auth:${route}:${requestIp}`, selected.maxAttempts, selected.windowMs);
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/signup', async (request, reply) => {
    const rateResult = enforceAuthRateLimit(request.ip, 'signup');
    if (!rateResult.allowed) {
      return reply
        .header('Retry-After', String(rateResult.retryAfterSeconds))
        .status(429)
        .send({ message: 'Too many signup attempts. Please try again later.' });
    }

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
        token: hashToken(token),
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24)
      }
    });

    if (process.env.NODE_ENV !== 'production') {
      app.log.info({ email, token }, 'Email verification token generated for local testing');
    }

    return {
      message: 'Account created. Please check your email to verify your account.'
    };
  });

  app.post('/auth/verify-email', async (request, reply) => {
    const rateResult = enforceAuthRateLimit(request.ip, 'verify-email');
    if (!rateResult.allowed) {
      return reply
        .header('Retry-After', String(rateResult.retryAfterSeconds))
        .status(429)
        .send({ message: 'Too many verification attempts. Please try again later.' });
    }

    const parsed = verifyEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const tokenHash = hashToken(parsed.data.token);
    const tokenRecord = await prisma.emailVerificationToken.findUnique({ where: { token: tokenHash } });
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
    const rateResult = enforceAuthRateLimit(request.ip, 'login');
    if (!rateResult.allowed) {
      return reply
        .header('Retry-After', String(rateResult.retryAfterSeconds))
        .status(429)
        .send({ message: 'Too many login attempts. Please try again later.' });
    }

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
