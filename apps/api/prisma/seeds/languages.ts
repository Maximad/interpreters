import { PrismaClient } from '@prisma/client';
import { languageCatalog } from './language-catalog';

export async function seedLanguages(prisma: PrismaClient) {
  await prisma.language.createMany({
    data: languageCatalog.map((name) => ({ name })),
    skipDuplicates: true
  });
}
