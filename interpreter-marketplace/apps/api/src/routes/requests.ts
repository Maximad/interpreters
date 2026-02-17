import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma';
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
  city: z.string().min(2),
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

const recipientCapDefault = Number(process.env.BROADCAST_RECIPIENT_CAP || 50);
const dailyRequestLimit = Number(process.env.DAILY_BROADCAST_LIMIT || 20);

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function meiliFilter(input: z.infer<typeof broadcastSchema>) {
  const clauses: string[] = [
    `(${stringEquals('languages', input.sourceLanguage)} OR ${stringEquals('languages', input.targetLanguage)})`,
    `(${stringEquals('domains', input.domain)})`,
    `(${stringEquals('cities', input.city)})`,
    `(${booleanEquals('onsite_enabled', input.onsiteRequired)})`,
    `(${booleanEquals('remote_enabled', input.remoteAllowed)})`
  ];

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
    const meiliResult = await app.meiliClient.index(app.meiliIndexName).search('', {
      filter: meiliFilter(input),
      limit: recipientCapDefault,
      sort: ['is_email_verified:desc', 'profile_completeness:desc', 'updated_at:desc']
    });

    const profileIds = meiliResult.hits.map((hit: any) => hit.id as string).slice(0, recipientCapDefault);

    const created = await prisma.request.create({
      data: {
        client_user_id: request.user.sub,
        source_language: input.sourceLanguage,
        target_language: input.targetLanguage,
        domain: input.domain,
        city: input.city,
        onsite_required: input.onsiteRequired,
        remote_allowed: input.remoteAllowed,
        scheduled_for: new Date(input.scheduledFor),
        budget_min_aed: input.budgetMinAed,
        budget_max_aed: input.budgetMaxAed,
        notes: input.notes
      }
    });

    const profiles = await prisma.interpreterProfile.findMany({
      where: { id: { in: profileIds } },
      include: { user: true }
    });

    await prisma.requestRecipient.createMany({
      data: profiles.map((profile) => ({ request_id: created.id, interpreter_profile_id: profile.id, notified_at: new Date() }))
    });

    const notificationRows = profiles.flatMap((profile) => {
      const base = {
        user_id: profile.user_id,
        category: 'BROADCAST_REQUEST',
        payload: { requestId: created.id, domain: created.domain, city: created.city }
      };

      if (profile.opt_out_broadcast_emails) {
        return [{ ...base, channel: 'DASHBOARD' as const }];
      }

      return [
        { ...base, channel: 'DASHBOARD' as const },
        {
          ...base,
          channel: 'EMAIL' as const,
          payload: {
            requestId: created.id,
            subject: 'New broadcast interpreting request',
            body: `Domain: ${created.domain} | City: ${created.city} | Time: ${created.scheduled_for.toISOString()}`
          }
        }
      ];
    });

    if (notificationRows.length) await prisma.notification.createMany({ data: notificationRows as any });

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

    const quote = await prisma.quote.upsert({
      where: {
        request_id_interpreter_profile_id: {
          request_id: params.data.id,
          interpreter_profile_id: profile.id
        }
      },
      create: {
        request_id: params.data.id,
        interpreter_profile_id: profile.id,
        client_user_id: recipient.request.client_user_id,
        amount_aed: body.data.amountAed,
        message: body.data.message,
        status: 'PENDING'
      },
      update: {
        amount_aed: body.data.amountAed,
        message: body.data.message,
        status: 'PENDING'
      }
    });

    await prisma.notification.create({
      data: {
        user_id: recipient.request.client_user_id,
        channel: 'DASHBOARD',
        category: 'QUOTE_SUBMITTED',
        payload: { requestId: params.data.id, quoteId: quote.id, amountAed: body.data.amountAed }
      }
    });

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

    const reqRow = await prisma.request.findFirst({ where: { id: parsed.data.id, client_user_id: request.user.sub } });
    if (!reqRow) return reply.status(404).send({ message: 'Request not found' });

    const accepted = await prisma.quote.findFirst({ where: { id: parsed.data.quoteId, request_id: reqRow.id } });
    if (!accepted) return reply.status(404).send({ message: 'Quote not found' });

    await prisma.$transaction([
      prisma.quote.update({ where: { id: accepted.id }, data: { status: 'ACCEPTED' } }),
      prisma.quote.updateMany({ where: { request_id: reqRow.id, id: { not: accepted.id } }, data: { status: 'REJECTED' } }),
      prisma.request.update({ where: { id: reqRow.id }, data: { status: 'FILLED', filled_quote_id: accepted.id } })
    ]);

    const allQuotes = await prisma.quote.findMany({
      where: { request_id: reqRow.id },
      include: { interpreter_profile: true }
    });

    await prisma.notification.createMany({
      data: allQuotes.map((quote) => ({
        user_id: quote.interpreter_profile.user_id,
        channel: 'DASHBOARD',
        category: quote.id === accepted.id ? 'QUOTE_ACCEPTED' : 'QUOTE_REJECTED',
        payload: { requestId: reqRow.id, quoteId: quote.id }
      }))
    });

    return { message: 'Quote accepted and request filled', requestId: reqRow.id, acceptedQuoteId: accepted.id };
  });

  app.get('/dashboard/client/requests', { preHandler: app.authorize(['CLIENT']) }, async (request) => {
    return prisma.request.findMany({ where: { client_user_id: request.user.sub }, include: { quotes: true, recipients: true }, orderBy: { created_at: 'desc' } });
  });

  app.get('/dashboard/interpreter/requests', { preHandler: app.authorize(['INTERPRETER']) }, async (request) => {
    const profile = await prisma.interpreterProfile.findUnique({ where: { user_id: request.user.sub } });
    if (!profile) return [];

    return prisma.requestRecipient.findMany({
      where: { interpreter_profile_id: profile.id },
      include: { request: true },
      orderBy: { sent_at: 'desc' }
    });
  });
};
