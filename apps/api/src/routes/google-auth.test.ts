import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { OAuth2Client } from 'google-auth-library';
import type { LoginTicket } from 'google-auth-library';
import authPlugin from '../plugins/auth';
import { prisma } from '../plugins/prisma';
import { hashPassword } from '../utils/security';
import { googleAuthRoutes } from './google-auth';

test('Google login requires an explicit link for an existing Nass account', async (t) => {
  const origin = 'https://interpreters.example.test';
  const clientId = 'test-client.apps.googleusercontent.com';
  const savedId = process.env.GOOGLE_CLIENT_ID;
  const savedOrigin = process.env.PUBLIC_BASE_URL;
  process.env.GOOGLE_CLIENT_ID = clientId;
  process.env.PUBLIC_BASE_URL = origin;
  t.after(() => {
    if (savedId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = savedId;
    if (savedOrigin === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = savedOrigin;
  });

  const original = { id: 'existing', email: 'Existing@gmail.com', role: 'INTERPRETER' as const,
    is_email_verified: true, google_subject: null as string | null, password_hash: hashPassword('existing-pass') };
  const users = [original];
  const usersDelegate = {
    findUnique: async ({ where }: { where: { id?: string; google_subject?: string } }) =>
      users.find((user) => where.id ? user.id === where.id : user.google_subject === where.google_subject) ?? null,
    findFirst: async ({ where }: { where: { email: { equals: string } } }) =>
      users.find((user) => user.email.toLowerCase() === where.email.equals) ?? null,
    updateMany: async ({ where, data }: { where: { id: string }; data: { google_subject: string } }) => {
      const index = users.findIndex((user) => user.id === where.id);
      users[index].google_subject = data.google_subject;
      return { count: 1 };
    },
    create: async ({ data }: { data: typeof original }) => {
      const user = { ...data, id: 'new-account' };
      users.push(user);
      return user;
    }
  };
  Object.defineProperty(prisma, 'user', { value: usersDelegate, configurable: true });
  t.after(() => Reflect.deleteProperty(prisma, 'user'));
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async ({ idToken, audience }: { idToken: string; audience: string }) => {
    assert.equal(audience, clientId);
    return { getPayload: () => JSON.parse(idToken) } as LoginTicket;
  });

  const app = Fastify();
  t.after(() => app.close());
  await app.register(jwt, { secret: 'unit-test-only' });
  await app.register(authPlugin);
  await app.register(googleAuthRoutes, { prefix: '/api' });

  const headers = { origin };
  const accountToken = app.jwt.sign({ sub: original.id, email: original.email, role: original.role });
  const linkHeaders = { ...headers, authorization: `Bearer ${accountToken}` };
  async function googleRequest(path: 'sign-in' | 'link', {
    subject = 'google-existing', email = 'existing@gmail.com', role, password, mismatch = false, link = false
  }: { subject?: string; email?: string; role?: string; password?: string; mismatch?: boolean; link?: boolean } = {}) {
    const challenge = await app.inject('/api/auth/google/challenge');
    const { nonce } = challenge.json<{ nonce: string }>();
    const setCookie = challenge.headers['set-cookie'];
    assert.equal(typeof setCookie, 'string');
    assert.match(setCookie as string, /HttpOnly/);
    assert.match(setCookie as string, /SameSite=Strict/);
    assert.match(setCookie as string, /Secure/);
    return app.inject({
      method: 'POST', url: `/api/auth/google/${path}`,
      headers: { ...(link ? linkHeaders : headers), cookie: (setCookie as string).split(';')[0] },
      payload: {
        credential: JSON.stringify({ sub: subject, email, email_verified: true, nonce: mismatch ? 'other-request' : nonce }),
        role, password
      }
    });
  }

  const crossOrigin = await app.inject({ method: 'POST', url: '/api/auth/google/sign-in',
    headers: { origin: 'https://other.example.test' }, payload: { credential: 'unit-test' } });
  assert.equal(crossOrigin.statusCode, 403);
  assert.equal((await googleRequest('sign-in', { mismatch: true })).statusCode, 400);
  assert.equal((await googleRequest('sign-in')).statusCode, 409);
  assert.equal(original.google_subject, null);

  assert.equal((await googleRequest('link', { password: 'existing-pass' })).statusCode, 401);
  assert.equal((await googleRequest('link', { link: true, password: 'wrong-password' })).statusCode, 403);
  assert.equal(original.google_subject, null);
  assert.equal((await googleRequest('link', { link: true, password: 'existing-pass' })).statusCode, 200);
  assert.equal(original.google_subject, 'google-existing');
  const returning = await googleRequest('sign-in', { role: 'CLIENT' });
  assert.equal(returning.statusCode, 200);
  assert.deepEqual(returning.json().user, { id: original.id, email: original.email, role: 'INTERPRETER' });

  const newProfile = { subject: 'google-new', email: 'new@gmail.com' };
  assert.equal((await googleRequest('sign-in', newProfile)).statusCode, 409);
  assert.equal((await googleRequest('sign-in', { ...newProfile, role: 'ADMIN' })).statusCode, 400);
  assert.equal((await googleRequest('sign-in', { ...newProfile, email: 'new@example.test', role: 'CLIENT' })).statusCode, 403);
  const registered = await googleRequest('sign-in', { ...newProfile, role: 'CLIENT' });
  assert.equal(registered.statusCode, 200);
  assert.equal(registered.json().user.role, 'CLIENT');
  assert.equal(users.length, 2);
  assert.equal(users[1].is_email_verified, true);
});
