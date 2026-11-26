import type { FastifyPluginAsync } from 'fastify';
import { NotificationChannel, type Prisma } from '@prisma/client';
import { z } from 'zod';
import { languageLabel } from '../../prisma/seeds/language-catalog';
import { prisma } from '../plugins/prisma';
import { languageDirection, languageKey, languagePair, parseLanguagePair } from '../utils/language-pair';

const availabilitySchema = z.object({
  domain: z.string().trim().min(2).max(200),
  city: z.string().trim().min(2).max(200).optional()
});

const broadcastSchema = availabilitySchema.extend({
  sourceLanguage: z.string().trim().min(1).max(200),
  targetLanguage: z.string().trim().min(1).max(200),
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
  amountAed: z.number().positive().max(99999999.99).refine((amount) => Number(amount.toFixed(2)) === amount),
  durationMinutes: z.number().int().min(1).max(1440),
  paymentTerms: z.string().trim().min(5).max(500),
  cancellationTerms: z.string().trim().min(5).max(500),
  message: z.string().trim().min(3).max(500).optional()
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

function availabilityWhere({ domain, city }: z.infer<typeof availabilitySchema>): Prisma.InterpreterProfileWhereInput {
  return {
    status: 'APPROVED',
    domains: { some: { domain: { name: { in: [domain], mode: 'insensitive' } } } },
    ...(city
      ? { onsite_enabled: true, cities: { some: { city: { name: { in: [city], mode: 'insensitive' } } } } }
      : { remote_enabled: true })
  };
}

export const requestRoutes: FastifyPluginAsync = async (app) => {
  app.get('/requests/options', async () => {
    const orderBy = { name: 'asc' } as const;
    const [domains, cities] = await Promise.all([
      prisma.domain.findMany({ orderBy }),
      prisma.city.findMany({ orderBy })
    ]);
    return { domains, cities };
  });

  app.get('/requests/language-pairs', async (request, reply) => {
    const parsed = availabilitySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ message: 'Choose a valid subject area and city' });

    const directions = await prisma.interpreterLanguage.findMany({
      where: { interpreter_profile: availabilityWhere(parsed.data) },
      select: { direction: true },
      distinct: ['direction']
    });
    const pairs = new Map<string, [string, string]>();
    const names = new Set<string>();
    for (const { direction } of directions) {
      const pair = languageDirection(direction);
      if (!pair) continue;
      pair.forEach((name) => names.add(name));
      pairs.set(languagePair(...pair), pair);
    }
    const languages = names.size > 0 ? await prisma.language.findMany({
      where: { name: { in: [...names], mode: 'insensitive' } },
      select: { name: true }
    }) : [];
    const labels = new Map(languages.map(({ name }) => [languageKey(name), name]));

    return reply.header('Cache-Control', 'no-store').send({
      pairs: Array.from(pairs.values(), ([source, target]) => {
        const sourceName = labels.get(languageKey(source)) ?? source;
        const targetName = labels.get(languageKey(target)) ?? target;
        return { source: sourceName, target: targetName, sourceLabel: languageLabel(sourceName), targetLabel: languageLabel(targetName) };
      })
    });
  });

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
    if (languageKey(input.sourceLanguage) === languageKey(input.targetLanguage)) {
      return reply.status(400).send({ message: 'Choose two different languages' });
    }

    const pair = languagePair(input.sourceLanguage, input.targetLanguage);
    const candidates = await prisma.interpreterProfile.findMany({
      where: {
        ...availabilityWhere({ domain: input.domain, city: input.onsiteRequired ? input.city : undefined }),
        ...(input.budgetMinAed !== undefined || input.budgetMaxAed !== undefined
          ? { hourly_rate_aed: { gte: input.budgetMinAed, lte: input.budgetMaxAed } }
          : {}),
        ...(input.minYears !== undefined ? { years_experience: { gte: input.minYears } } : {}),
        ...(input.verifiedOnly ? { user: { is_email_verified: true } } : {})
      },
      orderBy: [{ user: { is_email_verified: 'desc' } }, { profile_completeness: 'desc' }, { updated_at: 'desc' }],
      select: { id: true, user_id: true, opt_out_broadcast_emails: true, languages: { select: { direction: true } } }
    });
    const profiles = candidates.filter((profile) =>
      profile.languages.some(({ direction }) => parseLanguagePair(direction) === pair)
    ).slice(0, recipientCapDefault);
    if (profiles.length === 0) {
      return reply.status(409).send({ code: 'PAIR_UNAVAILABLE', message: 'No interpreters are available for these request options' });
    }

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
    if (!params.success) return reply.status(400).send({ message: 'Invalid request' });
    if (!body.success) {
      return reply.status(400).send({ code: 'INVALID_QUOTE_TERMS', message: 'Enter a valid price, duration, and payment and cancellation terms.' });
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
      const values = {
        amount_aed: body.data.amountAed,
        duration_minutes: body.data.durationMinutes,
        payment_terms: body.data.paymentTerms,
        cancellation_terms: body.data.cancellationTerms,
        message: body.data.message ?? null
      };
      if (existing?.amount_aed.equals(values.amount_aed) &&
        existing.duration_minutes === values.duration_minutes && existing.payment_terms === values.payment_terms &&
        existing.cancellation_terms === values.cancellation_terms && existing.message === values.message) return existing;
      const saved = await db.quote.upsert({
        where,
        create: { ...key, ...values, client_user_id: recipient.request.client_user_id, revision: 1 },
        update: { ...values, revision: { increment: 1 } }
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
    const body = z.object({
      expectedAmountAed: z.number().positive().optional(),
      expectedRevision: z.number().int().positive().optional()
    }).safeParse(request.body ?? {});
    if (!body.success) return reply.status(400).send({ message: 'Invalid quote confirmation' });

    const reqRow = await prisma.request.findFirst({ where: { id: parsed.data.id, client_user_id: request.user.sub } });
    if (!reqRow) return reply.status(404).send({ message: 'Request not found' });

    const quoteId = parsed.data.quoteId;
    const result = await prisma.$transaction(async (db) => {
      // Serialize confirmation with edits to the quote.
      const open = await db.request.updateMany({ where: { id: reqRow.id, status: 'OPEN' }, data: { status: 'OPEN' } });
      const selected = await db.quote.findFirst({ where: { id: quoteId, request_id: reqRow.id } });
      if (!selected) return 'missing';

      if (open.count === 0) {
        const current = await db.request.findUniqueOrThrow({ where: { id: reqRow.id } });
        return current.status === 'FILLED' && current.filled_quote_id === quoteId ? 'accepted' : 'closed';
      }
      if (!selected.duration_minutes || !selected.payment_terms?.trim() || !selected.cancellation_terms?.trim()) {
        return 'terms-required';
      }
      if (body.data.expectedRevision !== selected.revision ||
        (body.data.expectedAmountAed !== undefined && !selected.amount_aed.equals(body.data.expectedAmountAed))) {
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
    if (result === 'terms-required') return reply.status(409).send({ code: 'QUOTE_TERMS_REQUIRED', message: 'The interpreter needs to add the quote terms before you can confirm.' });
    if (result === 'changed') return reply.status(409).send({ message: 'Review the latest quote before accepting.' });
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
