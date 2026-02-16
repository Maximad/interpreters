import { PrismaClient } from '@prisma/client';

const languages = ['Arabic', 'English', 'Hindi', 'Urdu', 'French', 'Tagalog'];

export async function seedLanguages(prisma: PrismaClient) {
  await prisma.language.createMany({
    data: languages.map((name) => ({ name })),
    skipDuplicates: true
  });
}
