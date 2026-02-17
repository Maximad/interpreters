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
  await meiliClient.index(indexName).addDocuments(docs, { primaryKey: 'id' });
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
