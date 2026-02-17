import { PrismaClient } from '@prisma/client';
import { seedLanguages } from './seeds/languages';
import { seedDomains } from './seeds/domains';
import { seedCities } from './seeds/cities';

const prisma = new PrismaClient();

async function main() {
  await seedLanguages(prisma);
  await seedDomains(prisma);
  await seedCities(prisma);
  console.log('Seed complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
