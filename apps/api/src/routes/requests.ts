import type { FastifyPluginAsync } from 'fastify';
import { NotificationChannel, type Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../plugins/prisma';
import { languagePair } from '../utils/language-pair';
import {
  booleanEquals,
  numberGreaterThanOrEqual,
  numberLessThanOrEqual,
  stringEquals
} from '../utils/meili-filter';

const broadcastSchema = z.object({
  sourceLanguage: z.string().min(2),
  targetLanguage: z.string().min(2),
  domain: z.string().min(2),
  city: z.string().min(2).optional(),
  onsiteRequired: z.boolean(),
  remoteAllowed: z.boolean(),
  scheduledFor: z.string().datetime(),
  budgetMinAed: z.number().positive().optional(),
  budgetMaxAed: z.number().positive().optional(),
  notes: z.string().min(5).optional(),
  minYears: z.number().int().min(0).optional(),
  verifiedOnly: z.boolean().optional()
});

const quoteSchema = z.object({
  amountAed: z.number().positive(),
  message: z.string().min(3).optional()
});

const sessionSelect = { details: true, completed_at: true } satisfies Prisma.BookingSessionSelect;
const sessionParams = z.object({ id: z.string().cuid() });
const sessionDetails = z.object({ details: z.string().trim().min(1).max(1024) });

function meetingLink(value: string) {
  if (!URL.canParse(value)) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  return url.href;
}

async function lockBooking(db: Prisma.TransactionClient, id: string, user: { sub: string; role: string }) {
  const booking = await db.request.findUnique({
    where: { id },
    select: { status: true, client_user_id: true, filled_quote_id: true, onsite_required: true, scheduled_for: true }
  });
  if (!booking || booking.status !== 'FILLED' || !booking.filled_quote_id) return null;

  if (user.role === 'CLIENT') {
    if (booking.client_user_id !== user.sub) return null;
  } else if (user.role === 'INTERPRETER') {
    const accepted = await db.quote.findFirst({
      where: { id: booking.filled_quote_id, request_id: id, status: 'ACCEPTED', interpreter_profile: { user_id: user.sub } },
      select: { id: true }
    });
    if (!accepted) return null;
  } else {
    return null;
  }

  // Serialize edits and completion even when an older booking has no session row yet.
  const locked = await db.request.updateMany({
    where: { id, status: 'FILLED', filled_quote_id: booking.filled_quote_id },
    data: { status: 'FILLED' }
  });
  return locked.count === 1 ? booking : null;
}

const recipientCapDefault = Number(process.env.BROADCAST_RECIPIENT_CAP || 50);
const dailyRequestLimit = Number(process.env.DAILY_BROADCAST_LIMIT || 20);

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function meiliFilter(input: z.infer<typeof broadcastSchema>) {
  const clauses: string[] = [
    `(${stringEquals('language_pairs', languagePair(input.sourceLanguage, input.targetLanguage))})`,
    `(${stringEquals('domains', input.domain)})`
  ];
  if (input.onsiteRequired) {
    clauses.push(`(${stringEquals('cities', input.city ?? '')})`, `(${booleanEquals('onsite_enabled', true)})`);
  } else if (input.remoteAllowed) {
    clauses.push(`(${booleanEquals('remote_enabled', true)})`);
  }

  if (typeof input.budgetMinAed === 'number') clauses.push(`(${numberGreaterThanOrEqual('hourly_rate_aed', input.budgetMinAed)})`);
  if (typeof input.budgetMaxAed === 'number') clauses.push(`(${numberLessThanOrEqual('hourly_rate_aed', input.budgetMaxAed)})`);
  if (typeof input.minYears === 'number') clauses.push(`(${numberGreaterThanOrEqual('years_experience', input.minYears)})`);
  if (input.verifiedOnly) clauses.push(`(${booleanEquals('is_email_verified', true)})`);
  return clauses.join(' AND ');
}

export const requestRoutes: FastifyPluginAsync = async (app) => {
  app.post('/requests/broadcast', { preHandler: app.authorize(['CLIENT']) }, async (request, reply) => {
    const parsed = broadcastSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const countToday = await prisma.request.count({
      where: { client_user_id: request.user.sub, created_at: { gte: startOfToday() } }
    });
    if (countToday >= dailyRequestLimit) return reply.status(429).send({ message: 'Daily broadcast request limit reached' });

    const input = parsed.data;
    if (!input.onsiteRequired && !input.remoteAllowed) {
      return reply.status(400).send({ message: 'Choose on-site or remote interpreting' });
    }
    if (input.onsiteRequired && !input.city) {
      return reply.status(400).send({ message: 'Choose a city for on-site interpreting' });
    }
    if (languagePair(input.sourceLanguage, input.targetLanguage) === languagePair(input.targetLanguage, input.sourceLanguage)) {
      return reply.status(400).send({ message: 'Choose two different languages' });
    }
    const meiliResult = await app.meiliClient.index(app.meiliIndexName).search('', {
      filter: meiliFilter(input),
      limit: recipientCapDefault,
      sort: ['is_email_verified:desc', 'profile_completeness:desc', 'updated_at:desc']
    });

    const profileIds = meiliResult.hits
      .flatMap((hit) => {
        if (typeof (hit as { id?: unknown }).id === 'string') {
          return [(hit as { id: string }).id];
        }

        return [];
      })
      .slice(0, recipientCapDefault);

    const profiles = await prisma.interpreterProfile.findMany({
      where: { id: { in: profileIds }, status: 'APPROVED' },
      select: { id: true, user_id: true, opt_out_broadcast_emails: true }
    });

    const created = await prisma.$transaction(async (db) => {
      const newRequest = await db.request.create({
        data: {
          client_user_id: request.user.sub,
          source_language: input.sourceLanguage,
          target_language: input.targetLanguage,
          domain: input.domain,
          city: input.city ?? '',
          onsite_required: input.onsiteRequired,
          remote_allowed: input.remoteAllowed,
          scheduled_for: new Date(input.scheduledFor),
          budget_min_aed: input.budgetMinAed,
          budget_max_aed: input.budgetMaxAed,
          notes: input.notes,
          recipients: {
            create: profiles.map((profile) => ({ interpreter_profile_id: profile.id, notified_at: new Date() }))
          }
        }
      });

      const notificationRows: Prisma.NotificationCreateManyInput[] = profiles.flatMap((profile) => {
        const base = {
          user_id: profile.user_id,
          category: 'BROADCAST_REQUEST',
          payload: { requestId: newRequest.id, domain: newRequest.domain, city: newRequest.city }
        };

        if (profile.opt_out_broadcast_emails) {
          return [{ ...base, channel: NotificationChannel.DASHBOARD }];
        }

        return [
          { ...base, channel: NotificationChannel.DASHBOARD },
          {
            ...base,
            channel: NotificationChannel.EMAIL,
            payload: {
              requestId: newRequest.id,
              subject: 'New broadcast interpreting request',
              body: `Languages: ${newRequest.source_language} → ${newRequest.target_language}\nDomain: ${newRequest.domain}\n${newRequest.onsite_required ? `City: ${newRequest.city}` : 'Remote interpreting'}\nTime: ${newRequest.scheduled_for.toISOString()}`
            }
          }
        ];
      });

      if (notificationRows.length) await db.notification.createMany({ data: notificationRows });
      return newRequest;
    });

    return { request: created, matchedCount: profiles.length, recipientCap: recipientCapDefault };
  });

  app.post('/requests/:id/quotes', { preHandler: app.authorize(['INTERPRETER']) }, async (request, reply) => {
    const params = z.object({ id: z.string().cuid() }).safeParse(request.params);
    const body = quoteSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: { params: params.success ? null : params.error.flatten(), body: body.success ? null : body.error.flatten() } });
    }

    const profile = await prisma.interpreterProfile.findUnique({ where: { user_id: request.user.sub } });
    if (!profile) return reply.status(403).send({ message: 'Interpreter profile required' });

    const recipient = await prisma.requestRecipient.findUnique({
      where: {
        request_id_interpreter_profile_id: {
          request_id: params.data.id,
          interpreter_profile_id: profile.id
        }
      },
      include: { request: true }
    });
    if (!recipient) return reply.status(403).send({ message: 'Not a matched recipient for this request' });

    const quote = await prisma.$transaction(async (db) => {
      // Lock the request while quoting so acceptance and quote updates cannot race.
      const open = await db.request.updateMany({ where: { id: params.data.id, status: 'OPEN' }, data: { status: 'OPEN' } });
      if (open.count === 0) return null;

      const key = { request_id: params.data.id, interpreter_profile_id: profile.id };
      const where = { request_id_interpreter_profile_id: key };
      const existing = await db.quote.findUnique({ where });
      const message = body.data.message ?? null;
      if (existing?.amount_aed.equals(body.data.amountAed) && existing.message === message) return existing;

      const values = { amount_aed: body.data.amountAed, message };
      const saved = await db.quote.upsert({
        where,
        create: { ...key, ...values, client_user_id: recipient.request.client_user_id },
        update: values
      });

      await db.notification.create({
        data: {
          user_id: recipient.request.client_user_id,
          channel: 'DASHBOARD',
          category: 'QUOTE_SUBMITTED',
          payload: { requestId: params.data.id, quoteId: saved.id, amountAed: body.data.amountAed }
        }
      });
      return saved;
    });

    if (!quote) return reply.status(409).send({ message: 'This request is no longer open' });
    return quote;
  });

  app.get('/requests/:id/quotes', { preHandler: app.authorize(['CLIENT']) }, async (request, reply) => {
    const params = z.object({ id: z.string().cuid() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: params.error.flatten() });

    const reqRow = await prisma.request.findFirst({ where: { id: params.data.id, client_user_id: request.user.sub } });
    if (!reqRow) return reply.status(404).send({ message: 'Request not found' });

    return prisma.quote.findMany({
      where: { request_id: params.data.id },
      include: { interpreter_profile: { include: { user: { select: { full_name: true, id: true } } } } },
      orderBy: { created_at: 'desc' }
    });
  });

  app.post('/requests/:id/quotes/:quoteId/accept', { preHandler: app.authorize(['CLIENT']) }, async (request, reply) => {
    const parsed = z.object({ id: z.string().cuid(), quoteId: z.string().cuid() }).safeParse(request.params);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const body = z.object({ expectedAmountAed: z.number().positive().optional() }).safeParse(request.body ?? {});
    if (!body.success) return reply.status(400).send({ message: 'Invalid quote confirmation' });

    const reqRow = await prisma.request.findFirst({ where: { id: parsed.data.id, client_user_id: request.user.sub } });
    if (!reqRow) return reply.status(404).send({ message: 'Request not found' });

    const quoteId = parsed.data.quoteId;
    const result = await prisma.$transaction(async (db) => {
      // Serialize confirmation with edits to the quoted amount.
      const open = await db.request.updateMany({ where: { id: reqRow.id, status: 'OPEN' }, data: { status: 'OPEN' } });
      const selected = await db.quote.findFirst({ where: { id: quoteId, request_id: reqRow.id } });
      if (!selected) return 'missing';

      if (open.count === 0) {
        const current = await db.request.findUniqueOrThrow({ where: { id: reqRow.id } });
        return current.status === 'FILLED' && current.filled_quote_id === quoteId ? 'accepted' : 'closed';
      }
      if (body.data.expectedAmountAed !== undefined && !selected.amount_aed.equals(body.data.expectedAmountAed)) {
        return 'changed';
      }

      await db.request.update({ where: { id: reqRow.id }, data: { status: 'FILLED', filled_quote_id: quoteId } });
      await db.quote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED' } });
      await db.quote.updateMany({ where: { request_id: reqRow.id, id: { not: quoteId } }, data: { status: 'REJECTED' } });

      const quotes = await db.quote.findMany({
        where: { request_id: reqRow.id },
        select: { id: true, interpreter_profile: { select: { user_id: true } } }
      });
      await db.notification.createMany({
        data: quotes.map((quote) => ({
          user_id: quote.interpreter_profile.user_id,
          channel: 'DASHBOARD',
          category: quote.id === quoteId ? 'QUOTE_ACCEPTED' : 'QUOTE_REJECTED',
          payload: { requestId: reqRow.id, quoteId: quote.id }
        }))
      });
      return 'accepted';
    });

    if (result === 'missing') return reply.status(404).send({ message: 'Quote not found' });
    if (result === 'changed') return reply.status(409).send({ message: 'The quote price changed. Review the latest quote before accepting.' });
    if (result === 'closed') return reply.status(409).send({ message: 'This request is no longer open' });
    return { message: 'Quote accepted and request filled', requestId: reqRow.id, acceptedQuoteId: quoteId };
  });

  app.put('/requests/:id/session', { preHandler: app.authorize(['CLIENT']) }, async (request, reply) => {
    const params = sessionParams.safeParse(request.params);
    const body = sessionDetails.safeParse(request.body);
    if (!params.success || !body.success) return reply.status(400).send({ message: 'Enter valid meeting details' });

    const id = params.data.id;
    const result = await prisma.$transaction(async (db) => {
      const booking = await lockBooking(db, id, request.user);
      if (!booking) return 'missing';
      const details = booking.onsite_required ? body.data.details : meetingLink(body.data.details);
      if (!details || details.length > 1024) return 'invalid';

      const session = await db.bookingSession.findUnique({ where: { request_id: id }, select: sessionSelect });
      if (session?.completed_at) return 'completed';
      return db.bookingSession.upsert({
        where: { request_id: id },
        create: { request_id: id, details },
        update: { details },
        select: sessionSelect
      });
    });
    if (result === 'missing') return reply.status(404).send({ message: 'Booking not found' });
    if (result === 'invalid') return reply.status(400).send({ message: 'Enter an HTTPS meeting link' });
    if (result === 'completed') return reply.status(409).send({ message: 'This session is already complete' });
    return reply.header('Cache-Control', 'private, no-store').send(result);
  });

  app.post('/requests/:id/session/complete', { preHandler: app.authorize(['CLIENT', 'INTERPRETER']) }, async (request, reply) => {
    const params = sessionParams.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ message: 'Invalid booking' });

    const id = params.data.id;
    const result = await prisma.$transaction(async (db) => {
      const booking = await lockBooking(db, id, request.user);
      if (!booking) return 'missing';
      const session = await db.bookingSession.findUnique({ where: { request_id: id }, select: sessionSelect });
      if (session?.completed_at) return session;

      const completed_at = new Date();
      if (booking.scheduled_for > completed_at) return 'early';
      return db.bookingSession.upsert({
        where: { request_id: id },
        create: { request_id: id, completed_at },
        update: { completed_at },
        select: sessionSelect
      });
    });
    if (result === 'missing') return reply.status(404).send({ message: 'Booking not found' });
    if (result === 'early') return reply.status(409).send({ message: 'You can mark the session complete after its scheduled start' });
    return reply.header('Cache-Control', 'private, no-store').send(result);
  });

  app.get('/dashboard/client/requests', { preHandler: app.authorize(['CLIENT']) }, async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return prisma.request.findMany({
      where: { client_user_id: request.user.sub },
      include: {
        quotes: { include: { interpreter_profile: { select: { user: { select: { full_name: true } } } } } },
        recipients: true,
        session: { select: sessionSelect }
      },
      orderBy: { created_at: 'desc' }
    });
  });

  app.get('/dashboard/interpreter/requests', { preHandler: app.authorize(['INTERPRETER']) }, async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const profile = await prisma.interpreterProfile.findUnique({ where: { user_id: request.user.sub } });
    if (!profile) return [];

    const invitations = await prisma.requestRecipient.findMany({
      where: { interpreter_profile_id: profile.id },
      include: { request: { include: { quotes: { where: { interpreter_profile_id: profile.id } }, session: { select: sessionSelect } } } },
      orderBy: { sent_at: 'desc' }
    });
    return invitations.map(({ request, ...invitation }) => {
      const accepted = request.quotes.some((quote) => quote.status === 'ACCEPTED' && quote.id === request.filled_quote_id);
      return { ...invitation, request: { ...request, session: accepted ? request.session : null } };
    });
  });
};
