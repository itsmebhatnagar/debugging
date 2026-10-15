const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Check for dummy users
  const dummies = await prisma.user.findMany({
    where: {
      email: { in: ['captain@echona.com', 'crew@echona.com'] }
    },
    select: { id: true, name: true, email: true }
  })
  
  console.log('Dummy users found:', JSON.stringify(dummies, null, 2))
  
  if (dummies.length > 0) {
    const ids = dummies.map(u => u.id)
    
    // Delete related data first
    // Submissions -> scores -> AI analyses are cascade deleted via Prisma schema usually
    // But let's manually clean up to be safe
    
    // Find all question IDs for submissions
    const subs = await prisma.submission.findMany({
      where: { userId: { in: ids } },
      select: { id: true }
    })
    const subIds = subs.map(s => s.id)
    
    if (subIds.length > 0) {
      await prisma.aIAnalysis.deleteMany({ where: { submissionId: { in: subIds } } })
      await prisma.score.deleteMany({ where: { submissionId: { in: subIds } } })
    }
    
    await prisma.submission.deleteMany({ where: { userId: { in: ids } } })
    await prisma.compileAttempt.deleteMany({ where: { userId: { in: ids } } })
    await prisma.draftCode.deleteMany({ where: { userId: { in: ids } } })
    await prisma.competitionParticipant.deleteMany({ where: { userId: { in: ids } } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
    
    console.log(`✅ Deleted ${dummies.length} dummy users and all their data!`)
  } else {
    console.log('✅ No dummy users found in database!')
  }
  
  // Show all current users
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true }
  })
  console.log('\nAll current users:')
  console.log(JSON.stringify(allUsers, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
