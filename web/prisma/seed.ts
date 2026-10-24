import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  await prisma.user.updateMany({
    where: {
      role: 'ADMIN',
      email: { not: 'itsmebhatnagar.29@gmail.com' },
    },
    data: { role: 'USER' },
  })

  const adminPass = await bcrypt.hash('adminsecret', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'itsmebhatnagar.29@gmail.com' },
    update: {
      password: adminPass,
      role: 'ADMIN',
      name: 'Harshil Bhatnagar',
    },
    create: {
      email: 'itsmebhatnagar.29@gmail.com',
      password: adminPass,
      name: 'Harshil Bhatnagar',
      role: 'ADMIN',
    },
  })
  console.log(`Created admin user: ${admin.email}`)

  // Create a Sample Competition
  const comp = await prisma.competition.upsert({
    where: { id: 'comp_1' },
    update: {},
    create: {
      id: 'comp_1',
      name: 'Echona 2K26 Pirate Code Clash',
      description: 'A multi-round coding battle for the ultimate treasure.',
      status: 'DRAFT',
    },
  })
  console.log(`Created competition: ${comp.name}`)

  console.log('Database seeded successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
