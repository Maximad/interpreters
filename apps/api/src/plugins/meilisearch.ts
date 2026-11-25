import fp from 'fastify-plugin';
import { MeiliSearch } from 'meilisearch';

const indexName = process.env.MEILISEARCH_INTERPRETERS_INDEX || 'interpreters';

export default fp(async function meilisearchPlugin(fastify) {
  const host = process.env.MEILISEARCH_URL || 'http://localhost:7700';
  const apiKey = process.env.MEILISEARCH_API_KEY || process.env.MEILI_MASTER_KEY;
  const client = new MeiliSearch({ host, apiKey });

  fastify.decorate('meiliClient', client);
  fastify.decorate('meiliIndexName', indexName);

  const index = client.index(indexName);
  const filterable = await index.updateFilterableAttributes([
    'languages',
    'language_pairs',
    'domains',
    'cities',
    'onsite_enabled',
    'remote_enabled',
    'hourly_rate_aed',
    'years_experience',
    'is_email_verified'
  ]);

  const sortable = await index.updateSortableAttributes(['is_email_verified', 'profile_completeness', 'updated_at']);
  const results = await Promise.all([filterable, sortable].map(({ taskUid }) => client.waitForTask(taskUid)));
  if (results.some((task) => task.status !== 'succeeded')) throw new Error('Interpreter search settings could not be applied');
});
