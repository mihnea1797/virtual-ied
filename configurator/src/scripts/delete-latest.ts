import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const START_TIME = new Date('1970-01-01T00:00:00.060Z')
const BATCH_SIZE = 20
const INTERVAL_MS = 0.25

async function main() {
  const durationMs = BATCH_SIZE * INTERVAL_MS

  const endTime = new Date(START_TIME.getTime() + durationMs)

  console.log(`Delete values between ${START_TIME.toISOString()} and ${endTime.toISOString()}`)

  const deleted = await db.sampledValue.deleteMany({
    where: {
      time: {
        gte: START_TIME,
        lt: endTime,
      },
    },
  })

  console.log(`Deleted ${deleted.count} values`)
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
