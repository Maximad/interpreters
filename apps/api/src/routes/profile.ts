import type { FastifyPluginAsync } from 'fastify';
import { ProfileStatus, UserRole } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../plugins/prisma';
import { upsertInterpreterProfileToIndex } from '../utils/search-index';

const basicsSchema = z.object({
  fullName: z.string().min(2),
  headline: z.string().min(4),
  cityId: z.number().int().positive()
});

const languagesSchema = z.object({
  languages: z
    .array(
      z.object({
        languageId: z.number().int().positive(),
        direction: z.string().min(3),
        proficiencyLevel: z.string().min(2).optional()
      })
    )
    .min(1)
});

const domainSchema = z.object({
  domainIds: z.array(z.number().int().positive()).min(1),
  onsiteEnabled: z.boolean(),
  remoteEnabled: z.boolean(),
  coveredCityIds: z.array(z.number().int().positive()).min(1)
});

const ratesSchema = z.object({
  hourlyRateAed: z.number().positive(),
  yearsExperience: z.number().int().min(0),
  availabilityNotes: z.string().min(3)
});

const certificationSchema = z.object({
  certifications: z
    .array(
      z.object({
        name: z.string().min(2),
        fileUrl: z.string().url(),
        isPrivate: z.boolean().default(true)
      })
    )
    .min(1)
});

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().min(5).optional()
});

async function upsertProfile(userId: string) {
  return prisma.interpreterProfile.upsert({
    where: { user_id: userId },
    create: { user_id: userId },
    update: {}
  });
}

function completenessScore(profile: {
  headline: string | null;
  years_experience: number;
  hourly_rate_aed: unknown;
  availability_notes: string | null;
  onsite_enabled: boolean;
  remote_enabled: boolean;
  languages: unknown[];
  domains: unknown[];
  cities: unknown[];
  certifications: unknown[];
}) {
  let score = 0;
  if (profile.headline) score += 20;
  if (profile.languages.length > 0) score += 20;
  if (profile.domains.length > 0 && profile.cities.length > 0 && (profile.onsite_enabled || profile.remote_enabled)) score += 20;
  if (profile.hourly_rate_aed && profile.years_experience >= 0 && profile.availability_notes) score += 20;
  if (profile.certifications.length > 0) score += 20;
  return score;
}

async function refreshCompleteness(userId: string) {
  const profile = await prisma.interpreterProfile.findUniqueOrThrow({
    where: { user_id: userId },
    include: {
      languages: true,
      domains: true,
      cities: true,
      certifications: true
    }
  });

  const score = completenessScore(profile);
  const nextStatus = profile.status === ProfileStatus.APPROVED ? ProfileStatus.APPROVED : ProfileStatus.DRAFT;

  return prisma.interpreterProfile.update({
    where: { id: profile.id },
    data: {
      profile_completeness: score,
      status: nextStatus
    }
  });
}

async function ensureInterpreter(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.role === UserRole.INTERPRETER;
}

export const profileRoutes: FastifyPluginAsync = async (app) => {
  app.get('/profile/me', { preHandler: app.authorize(['INTERPRETER']) }, async (request, reply) => {
    const profile = await prisma.interpreterProfile.findUnique({
      where: { user_id: request.user.sub },
      include: { languages: true, domains: true, cities: true, certifications: true }
    });

    if (!profile) return reply.status(404).send({ message: 'Profile not found' });
    return profile;
  });

  app.put('/profile/wizard/step1', { preHandler: app.authorize(['INTERPRETER']) }, async (request, reply) => {
    const parsed = basicsSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const allowed = await ensureInterpreter(request.user.sub);
    if (!allowed) return reply.status(403).send({ message: 'Forbidden' });

    await prisma.user.update({ where: { id: request.user.sub }, data: { full_name: parsed.data.fullName } });

    const profile = await upsertProfile(request.user.sub);
    await prisma.interpreterProfile.update({
      where: { id: profile.id },
      data: { headline: parsed.data.headline, bio: `Based in city #${parsed.data.cityId}` }
    });

    return refreshCompleteness(request.user.sub);
  });

  app.put('/profile/wizard/step2', { preHandler: app.authorize(['INTERPRETER']) }, async (request, reply) => {
    const parsed = languagesSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const profile = await upsertProfile(request.user.sub);
    await prisma.$transaction([
      prisma.interpreterLanguage.deleteMany({ where: { interpreter_profile_id: profile.id } }),
      prisma.interpreterLanguage.createMany({
        data: parsed.data.languages.map((item) => ({
          interpreter_profile_id: profile.id,
          language_id: item.languageId,
          direction: item.direction,
          proficiency_level: item.proficiencyLevel
        }))
      })
    ]);

    return refreshCompleteness(request.user.sub);
  });

  app.put('/profile/wizard/step3', { preHandler: app.authorize(['INTERPRETER']) }, async (request, reply) => {
    const parsed = domainSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const profile = await upsertProfile(request.user.sub);
    await prisma.$transaction([
      prisma.interpreterDomain.deleteMany({ where: { interpreter_profile_id: profile.id } }),
      prisma.interpreterCity.deleteMany({ where: { interpreter_profile_id: profile.id } }),
      prisma.interpreterDomain.createMany({
        data: parsed.data.domainIds.map((domainId) => ({ interpreter_profile_id: profile.id, domain_id: domainId }))
      }),
      prisma.interpreterCity.createMany({
        data: parsed.data.coveredCityIds.map((cityId) => ({ interpreter_profile_id: profile.id, city_id: cityId }))
      }),
      prisma.interpreterProfile.update({
        where: { id: profile.id },
        data: { onsite_enabled: parsed.data.onsiteEnabled, remote_enabled: parsed.data.remoteEnabled }
      })
    ]);

    return refreshCompleteness(request.user.sub);
  });

  app.put('/profile/wizard/step4', { preHandler: app.authorize(['INTERPRETER']) }, async (request, reply) => {
    const parsed = ratesSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const profile = await upsertProfile(request.user.sub);
    await prisma.interpreterProfile.update({
      where: { id: profile.id },
      data: {
        hourly_rate_aed: parsed.data.hourlyRateAed,
        years_experience: parsed.data.yearsExperience,
        availability_notes: parsed.data.availabilityNotes
      }
    });

    return refreshCompleteness(request.user.sub);
  });

  app.put('/profile/wizard/step5', { preHandler: app.authorize(['INTERPRETER']) }, async (request, reply) => {
    const parsed = certificationSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const profile = await upsertProfile(request.user.sub);
    await prisma.$transaction([
      prisma.certification.deleteMany({ where: { interpreter_profile_id: profile.id } }),
      prisma.certification.createMany({
        data: parsed.data.certifications.map((item) => ({
          interpreter_profile_id: profile.id,
          name: item.name,
          file_url: item.fileUrl,
          is_private: item.isPrivate ?? true
        }))
      })
    ]);

    return refreshCompleteness(request.user.sub);
  });


  app.put('/profile/broadcast-preferences', { preHandler: app.authorize(['INTERPRETER']) }, async (request, reply) => {
    const parsed = z.object({ optOutBroadcastEmails: z.boolean() }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const profile = await upsertProfile(request.user.sub);
    return prisma.interpreterProfile.update({
      where: { id: profile.id },
      data: { opt_out_broadcast_emails: parsed.data.optOutBroadcastEmails }
    });
  });

  app.post('/profile/submit', { preHandler: app.authorize(['INTERPRETER']) }, async (request, reply) => {
    const profile = await prisma.interpreterProfile.findUnique({ where: { user_id: request.user.sub } });
    if (!profile) return reply.status(400).send({ message: 'Complete profile wizard first' });
    if (profile.profile_completeness < 100) {
      return reply.status(400).send({ message: 'Profile must be 100% complete before submission' });
    }

    const updated = await prisma.interpreterProfile.update({
      where: { id: profile.id },
      data: { status: 'PENDING', submitted_at: new Date(), rejection_reason: null }
    });

    await upsertInterpreterProfileToIndex(prisma, app.meiliClient, app.meiliIndexName, updated.id);
    return updated;
  });

  app.post('/admin/profiles/:id/review', { preHandler: app.authorize(['ADMIN']) }, async (request, reply) => {
    const params = z.object({ id: z.string().cuid() }).safeParse(request.params);
    const body = reviewSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: {
          params: params.success ? null : params.error.flatten(),
          body: body.success ? null : body.error.flatten()
        }
      });
    }

    if (body.data.status === 'REJECTED' && !body.data.rejectionReason) {
      return reply.status(400).send({ message: 'Rejection reason is required when rejecting a profile' });
    }

    const updated = await prisma.interpreterProfile.update({
      where: { id: params.data.id },
      data: {
        status: body.data.status,
        rejection_reason: body.data.status === 'REJECTED' ? body.data.rejectionReason : null,
        reviewed_at: new Date()
      }
    });

    await upsertInterpreterProfileToIndex(prisma, app.meiliClient, app.meiliIndexName, updated.id);
    return updated;
  });

};
