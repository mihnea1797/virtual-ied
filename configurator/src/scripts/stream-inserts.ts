import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const START_TIME = new Date('1970-01-01T00:00:00.000Z')
const STEP_MS = 1 
const REAL_SLEEP_MS = 10 
const STEP_AT_MS = 20 
const STEP_AMPLITUDE = 234
const NOISE_SIGMA = 4    

function gaussRandom(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log(`🚀 Starting stream from ${START_TIME.toISOString()}`)

  let i = 0
  while (true) {
    const t = new Date(START_TIME.getTime() + i * STEP_MS)

    const ideal = i < STEP_AT_MS ? 0 : STEP_AMPLITUDE

    const noisy = parseFloat(
      (ideal + gaussRandom() * NOISE_SIGMA).toFixed(6)
    )

    await db.sampledValue.createMany({
      data: [
        { time: t, value: ideal,   filtered: false },
        { time: t, value: noisy,   filtered: true  },
      ],
    })

    i++
    await sleep(REAL_SLEEP_MS)
  }
}

main().catch(err => {
  console.error('❌ Stream error:', err)
  process.exit(1)
})
