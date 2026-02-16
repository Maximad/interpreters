import { PrismaClient } from '@prisma/client';

const cities = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain',
  'Al Ain'
];

export async function seedCities(prisma: PrismaClient) {
  await prisma.city.createMany({
    data: cities.map((name) => ({ name })),
    skipDuplicates: true
  });
}
