import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const ADMIN_EMAIL = 'debugging@echona.com'

async function main() {
  console.log('Seeding database...')

  await prisma.user.updateMany({
    where: {
      role: 'ADMIN',
      email: { not: ADMIN_EMAIL },
    },
    data: { role: 'USER' },
  })

  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, password: true, role: true },
  })
  const adminPassword = process.env.ADMIN_PASSWORD
  const needsAdminPassword = !existingAdmin || existingAdmin.role !== 'ADMIN' || !existingAdmin.password
  if (needsAdminPassword && !adminPassword) {
    throw new Error('ADMIN_PASSWORD must be set when creating the admin account.')
  }

  const adminPass = adminPassword ? await bcrypt.hash(adminPassword, 10) : null
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      role: 'ADMIN',
      name: 'Admin',
      ...(needsAdminPassword ? { password: adminPass } : {}),
    },
    create: {
      email: ADMIN_EMAIL,
      password: adminPass,
      name: 'Admin',
      role: 'ADMIN',
    },
  })
  console.log(`Created admin user: ${admin.email}`)

  await prisma.adminAuthState.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  })

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
