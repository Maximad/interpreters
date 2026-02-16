import { PrismaClient } from '@prisma/client';

const domains = ['Legal', 'Medical', 'Business', 'Conference', 'Government'];

export async function seedDomains(prisma: PrismaClient) {
  await prisma.domain.createMany({
    data: domains.map((name) => ({ name })),
    skipDuplicates: true
  });
}
