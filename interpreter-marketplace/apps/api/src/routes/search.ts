import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  booleanEquals,
  numberGreaterThanOrEqual,
  numberLessThanOrEqual,
  stringEquals
} from '../utils/meili-filter';

const querySchema = z.object({
  q: z.string().optional(),
  languages: z.string().optional(),
  domains: z.string().optional(),
  cities: z.string().optional(),
  onsite: z.enum(['true', 'false']).optional(),
  remote: z.enum(['true', 'false']).optional(),
  min_rate: z.coerce.number().optional(),
  max_rate: z.coerce.number().optional(),
  min_years: z.coerce.number().int().min(0).optional(),
  verified_only: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

function parseList(value?: string) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildFilters(parsed: z.infer<typeof querySchema>) {
  const filters: string[] = [];

  const languages = parseList(parsed.languages);
  const domains = parseList(parsed.domains);
  const cities = parseList(parsed.cities);

  if (languages.length) {
    filters.push(`(${languages.map((item) => stringEquals('languages', item)).join(' OR ')})`);
  }
  if (domains.length) {
    filters.push(`(${domains.map((item) => stringEquals('domains', item)).join(' OR ')})`);
  }
  if (cities.length) {
    filters.push(`(${cities.map((item) => stringEquals('cities', item)).join(' OR ')})`);
  }
  if (parsed.onsite) filters.push(booleanEquals('onsite_enabled', parsed.onsite === 'true'));
  if (parsed.remote) filters.push(booleanEquals('remote_enabled', parsed.remote === 'true'));
  if (typeof parsed.min_rate === 'number') filters.push(numberGreaterThanOrEqual('hourly_rate_aed', parsed.min_rate));
  if (typeof parsed.max_rate === 'number') filters.push(numberLessThanOrEqual('hourly_rate_aed', parsed.max_rate));
  if (typeof parsed.min_years === 'number') filters.push(numberGreaterThanOrEqual('years_experience', parsed.min_years));
  if (parsed.verified_only === 'true') filters.push(booleanEquals('is_email_verified', true));

  return filters.length ? filters.join(' AND ') : undefined;
}

export const searchRoutes: FastifyPluginAsync = async (app) => {
  app.get('/search/interpreters', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { page, page_size } = parsed.data;
    const index = app.meiliClient.index(app.meiliIndexName);
    const filter = buildFilters(parsed.data);

    const result = await index.search(parsed.data.q || '', {
      filter,
      sort: ['is_email_verified:desc', 'profile_completeness:desc', 'updated_at:desc'],
      limit: page_size,
      offset: (page - 1) * page_size
    });

    return {
      page,
      page_size,
      total: result.estimatedTotalHits || 0,
      hits: result.hits
    };
  });

  app.get('/search/interpreters/:id', async (request, reply) => {
    const params = z.object({ id: z.string().cuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: params.error.flatten() });
    }

    const profile = await app.meiliClient.index(app.meiliIndexName).getDocument(params.data.id).catch(() => null);
    if (!profile) return reply.status(404).send({ message: 'Profile not found' });
    return profile;
  });
};
