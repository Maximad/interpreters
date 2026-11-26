import cookie from '@fastify/cookie';
import { Prisma, type User } from '@prisma/client';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { prisma } from '../plugins/prisma';
import { publicOrigin } from '../utils/email';
import { makeToken, verifyPassword } from '../utils/security';
import { enforceAuthRateLimit } from './auth';

const challengeCookie = 'im_google_challenge';
const challengeLifetime = 5 * 60;

// This value has no salt or hash and cannot pass password verification.
const googleOnlyPassword = 'google-only';
const credentialSchema = z.object({ credential: z.string().min(1).max(16384) });
const signInSchema = credentialSchema.extend({ role: z.enum(['CLIENT', 'INTERPRETER']).optional() });
const linkSchema = credentialSchema.extend({ password: z.string().min(8) });

function alreadyExists(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function session(reply: FastifyReply, account: Pick<User, 'id' | 'email' | 'role'>) {
  const user = { id: account.id, email: account.email, role: account.role };
  return reply.jwtSign({ sub: user.id, email: user.email, role: user.role })
    .then((token) => reply.header('Cache-Control', 'no-store').send({ token, user }));
}

export const googleAuthRoutes: FastifyPluginAsync = async (app) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const origin = publicOrigin();
  const enabled = Boolean(clientId && origin);
  app.get('/auth/google/config', async (_request, reply) =>
    reply.header('Cache-Control', 'no-store').send({ enabled })
  );
  if (!clientId || !origin) return;

  await app.register(cookie, { secret: makeToken() });
  const google = new OAuth2Client(clientId);
  const scope = { path: '/api/auth/google', secure: origin.startsWith('https://'), sameSite: 'strict' as const };

  app.get('/auth/google/challenge', async (_request, reply) => {
    const nonce = makeToken();
    reply.setCookie(challengeCookie, `${nonce}.${Date.now() + challengeLifetime * 1000}`, {
      ...scope, httpOnly: true, signed: true, maxAge: challengeLifetime
    });
    return reply.header('Cache-Control', 'no-store').send({ clientId, nonce });
  });

  async function identity(request: FastifyRequest, reply: FastifyReply, credential: string) {
    if (request.headers.origin !== origin) {
      reply.status(403).send({ code: 'failed', message: 'Invalid sign-in origin.' });
      return null;
    }
    const rate = enforceAuthRateLimit(request.ip, 'google');
    if (!rate.allowed) {
      reply.header('Retry-After', String(rate.retryAfterSeconds)).status(429)
        .send({ code: 'tryLater', message: 'Too many sign-in attempts. Try again later.' });
      return null;
    }
    const signed = request.cookies[challengeCookie];
    const challenge = signed ? request.unsignCookie(signed) : null;
    reply.clearCookie(challengeCookie, scope);
    const [nonce, expiry] = challenge?.valid && challenge.value ? challenge.value.split('.') : [];
    if (!nonce || !(Number(expiry) > Date.now())) {
      reply.status(400).send({ code: 'expired', message: 'The Google sign-in request expired. Try again.' });
      return null;
    }

    try {
      const ticket = await google.verifyIdToken({ idToken: credential, audience: clientId });
      const payload = ticket.getPayload();
      const tokenNonce = (payload as { nonce?: unknown } | undefined)?.nonce;
      if (!payload?.sub || tokenNonce !== nonce) throw new Error('Invalid Google token');
      return payload;
    } catch {
      reply.status(400).send({ code: 'failed', message: 'Could not verify Google sign-in. Try again.' });
      return null;
    }
  }

  app.post('/auth/google/sign-in', async (request, reply) => {
    const form = signInSchema.safeParse(request.body);
    if (!form.success) return reply.status(400).send({ code: 'failed', message: 'Invalid Google sign-in request.' });
    const profile = await identity(request, reply, form.data.credential);
    if (!profile) return;
    const linked = await prisma.user.findUnique({ where: { google_subject: profile.sub } });
    if (linked?.is_email_verified) return session(reply, linked);
    if (linked) return reply.status(403).send({ code: 'verifyEmail', message: 'Verify your Nass email before signing in.' });

    const email = profile.email?.trim().toLowerCase();
    if (email && await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })) {
      return reply.status(409).send({ code: 'useNassPassword', message: 'Sign in with your Nass password, then link Google in Account settings.' });
    }
    if (!form.data.role) return reply.status(409).send({ code: 'chooseRole', message: 'Choose Create account first to select your role.' });
    if (!email || !profile.email_verified || (!email.endsWith('@gmail.com') && !profile.hd)) {
      return reply.status(403).send({ code: 'useVerifiedGoogleEmail', message: 'Use a verified Gmail or Google Workspace address, or sign up with email.' });
    }

    try {
      const created = await prisma.user.create({ data: {
        email,
        full_name: profile.name?.trim() || email.split('@')[0],
        password_hash: googleOnlyPassword,
        is_email_verified: true,
        google_subject: profile.sub,
        role: form.data.role
      } });
      return session(reply, created);
    } catch (error) {
      if (!alreadyExists(error)) throw error;
      return reply.status(409).send({ code: 'accountExists', message: 'This account already exists. Sign in to continue.' });
    }
  });

  const signedIn = { preHandler: app.authorize(['CLIENT', 'INTERPRETER', 'ADMIN']) };
  app.get('/auth/google/account', signedIn, async (request, reply) => {
    const account = await prisma.user.findUnique({ where: { id: request.user.sub }, select: { google_subject: true } });
    if (!account) return reply.status(401).send({ message: 'Sign in to continue.' });
    return reply.header('Cache-Control', 'no-store').send({ linked: Boolean(account.google_subject) });
  });

  app.post('/auth/google/link', signedIn, async (request, reply) => {
    const form = linkSchema.safeParse(request.body);
    if (!form.success) return reply.status(400).send({ code: 'passwordRequired', message: 'Enter your current Nass password.' });
    const profile = await identity(request, reply, form.data.credential);
    if (!profile) return;
    const account = await prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!account?.is_email_verified || !verifyPassword(form.data.password, account.password_hash)) {
      return reply.status(403).send({ code: 'passwordRequired', message: 'Enter your current Nass password.' });
    }

    try {
      const linked = await prisma.user.updateMany({
        where: { id: account.id, OR: [{ google_subject: null }, { google_subject: profile.sub }] },
        data: { google_subject: profile.sub }
      });
      if (linked.count === 0) return reply.status(409).send({ code: 'differentGoogleAccount', message: 'This Nass account already has a different Google login.' });
      return reply.header('Cache-Control', 'no-store').send({ linked: true });
    } catch (error) {
      if (!alreadyExists(error)) throw error;
      return reply.status(409).send({ code: 'alreadyLinked', message: 'That Google account is linked to another Nass account.' });
    }
  });
};
