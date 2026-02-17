import { PrismaClient, ProfileStatus } from '@prisma/client';
import { MeiliSearch } from 'meilisearch';

export type InterpreterSearchDoc = {
  id: string;
  full_name: string;
  headline: string | null;
  bio: string | null;
  languages: string[];
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
  languages: Array<{ language: { name: string } }>;
  domains: Array<{ domain: { name: string } }>;
  cities: Array<{ city: { name: string } }>;
}): InterpreterSearchDoc {
  return {
    id: profile.id,
    full_name: profile.user.full_name,
    headline: profile.headline,
    bio: profile.bio,
    languages: profile.languages.map((item) => item.language.name),
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

  const addTask = await index.addDocuments(docs, { primaryKey: 'id' });
  console.info(`[search-sync] addDocuments enqueued for ${indexName} with task ${addTask.taskUid}; upserts=${docs.length}`);
  await meiliClient.waitForTask(addTask.taskUid);
  console.info(`[search-sync] addDocuments completed for ${indexName}; upserts=${docs.length}`);
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

  if (!profile || profile.status !== 'APPROVED') {
    await meiliClient.index(indexName).deleteDocument(profileId);
    return;
  }

  await meiliClient.index(indexName).addDocuments([toDoc(profile)], { primaryKey: 'id' });
}
