import { PrismaClient, ProfileStatus } from '@prisma/client';
import { MeiliSearch } from 'meilisearch';
import { languageDirection, parseLanguagePair } from './language-pair';

export type InterpreterSearchDoc = {
  id: string;
  full_name: string;
  headline: string | null;
  bio: string | null;
  languages: string[];
  language_pairs: string[];
  domains: string[];
  cities: string[];
  onsite_enabled: boolean;
  remote_enabled: boolean;
  hourly_rate_aed: number | null;
  years_experience: number;
  profile_completeness: number;
  status: ProfileStatus;
  is_email_verified: boolean;
  updated_at: string;
};

function toDoc(profile: {
  id: string;
  headline: string | null;
  bio: string | null;
  onsite_enabled: boolean;
  remote_enabled: boolean;
  hourly_rate_aed: unknown;
  years_experience: number;
  profile_completeness: number;
  status: ProfileStatus;
  updated_at: Date;
  user: { full_name: string; is_email_verified: boolean };
  languages: Array<{ language: { name: string }; direction: string }>;
  domains: Array<{ domain: { name: string } }>;
  cities: Array<{ city: { name: string } }>;
}): InterpreterSearchDoc {
  return {
    id: profile.id,
    full_name: profile.user.full_name,
    headline: profile.headline,
    bio: profile.bio,
    languages: [...new Set(profile.languages.flatMap((item) => [
      item.language.name, ...(languageDirection(item.direction) ?? [])
    ]))],
    language_pairs: Array.from(new Set(profile.languages.flatMap((item) => {
      const pair = parseLanguagePair(item.direction);
      return pair ? [pair] : [];
    }))),
    domains: profile.domains.map((item) => item.domain.name),
    cities: profile.cities.map((item) => item.city.name),
    onsite_enabled: profile.onsite_enabled,
    remote_enabled: profile.remote_enabled,
    hourly_rate_aed: profile.hourly_rate_aed ? Number(profile.hourly_rate_aed) : null,
    years_experience: profile.years_experience,
    profile_completeness: profile.profile_completeness,
    status: profile.status,
    is_email_verified: profile.user.is_email_verified,
    updated_at: profile.updated_at.toISOString()
  };
}

export async function syncApprovedInterpreterProfiles(prisma: PrismaClient, meiliClient: MeiliSearch, indexName: string) {
  const profiles = await prisma.interpreterProfile.findMany({
    where: { status: 'APPROVED' },
    include: {
      user: { select: { full_name: true, is_email_verified: true } },
      languages: { include: { language: true } },
      domains: { include: { domain: true } },
      cities: { include: { city: true } }
    }
  });

  const docs = profiles.map(toDoc);
  const index = meiliClient.index(indexName);
  const approvedIds = new Set(docs.map((doc: InterpreterSearchDoc) => doc.id));

  console.info(`[search-sync] Starting full sync for ${indexName} with ${docs.length} approved profiles`);

  let staleIds: string[] = [];
  try {
    const indexedIds: string[] = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
      const response = await index.getDocuments<{ id: string }>({
        fields: ['id'],
        limit,
        offset
      });

      indexedIds.push(...response.results.map((doc) => doc.id));
      if (response.results.length < limit) {
        break;
      }

      offset += limit;
    }

    staleIds = indexedIds.filter((id) => !approvedIds.has(id));
    if (staleIds.length > 0) {
      const deleteTask = await index.deleteDocuments(staleIds);
      await meiliClient.waitForTask(deleteTask.taskUid);
    }
    console.info(`[search-sync] stale document cleanup completed for ${indexName}; stale deletions=${staleIds.length}`);
  } catch (error) {
    console.error(`[search-sync] Failed to fetch indexed ids for ${indexName}; skipping stale deletions`, error);
  }

  if (docs.length > 0) {
    const addTask = await index.addDocuments(docs, { primaryKey: 'id' });
    const result = await meiliClient.waitForTask(addTask.taskUid);
    if (result.status !== 'succeeded') throw new Error('Interpreter indexing failed');
  }
  console.info(`[search-sync] Full sync completed for ${indexName}; stale deletions=${staleIds.length}; upserts=${docs.length}`);
}

export async function upsertInterpreterProfileToIndex(
  prisma: PrismaClient,
  meiliClient: MeiliSearch,
  indexName: string,
  profileId: string
) {
  const profile = await prisma.interpreterProfile.findUnique({
    where: { id: profileId },
    include: {
      user: { select: { full_name: true, is_email_verified: true } },
      languages: { include: { language: true } },
      domains: { include: { domain: true } },
      cities: { include: { city: true } }
    }
  });

  const index = meiliClient.index(indexName);
  const task = !profile || profile.status !== 'APPROVED'
    ? await index.deleteDocument(profileId)
    : await index.addDocuments([toDoc(profile)], { primaryKey: 'id' });
  const result = await meiliClient.waitForTask(task.taskUid);
  if (result.status !== 'succeeded') throw new Error('Interpreter indexing failed');
}
