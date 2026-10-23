import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  await prisma.user.updateMany({
    where: {
      role: 'ADMIN',
      email: { notIn: ['debugging@admin2026.com', 'itsmebhatnagar.29@gmail.com'] },
    },
    data: { role: 'USER' },
  })

  const debugAdminPass = await bcrypt.hash('Debugging@admin-2026', 10)
  const debugAdmin = await prisma.user.upsert({
    where: { email: 'debugging@admin2026.com' },
    update: {
      password: debugAdminPass,
      role: 'ADMIN',
      name: 'Debugging Admin',
    },
    create: {
      email: 'debugging@admin2026.com',
      password: debugAdminPass,
      name: 'Debugging Admin',
      role: 'ADMIN',
    },
  })
  console.log(`Created admin user: ${debugAdmin.email}`)

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
