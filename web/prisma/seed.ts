import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create Default Admin User
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@echona.com' },
    update: {},
    create: {
      email: 'admin@echona.com',
      password: hashedPassword,
      name: 'Blackbeard Admin',
      role: 'ADMIN',
    },
  })
  console.log(`Created admin user: ${admin.email}`)

  // Create Debugging Admin User
  const debugAdminPass = await bcrypt.hash('Admin@Debugging2026', 10)
  const debugAdmin = await prisma.user.upsert({
    where: { email: 'admin@debugging.com' },
    update: {
      password: debugAdminPass,
      role: 'ADMIN',
      name: 'Admin Debugging',
    },
    create: {
      email: 'admin@debugging.com',
      password: debugAdminPass,
      name: 'Admin Debugging',
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
