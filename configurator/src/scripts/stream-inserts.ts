import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const APP_ID         = 'test-stream'
const PHASES         = [1, 2, 3] as const

// parametrizarea fluxului
const STEP_AT_MS     = 20      // dupa cati pasi sa creasca amplitudinea
const STEP_AMPLITUDE = 234
const NOISE_SIGMA    = 4       // deviatie standard pentru zgomot
const REAL_SLEEP_MS  = 10      // cat asteptam real intre batch-uri

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
  console.log(`🚀 Starting real-time stream`)

  let i = 0
  while (true) {
    // Timpul curent
    const t = new Date()

    const ideal = i < STEP_AT_MS ? 0 : STEP_AMPLITUDE

    const batchData = PHASES.map(phase => {
      const noisy = parseFloat((ideal + gaussRandom() * NOISE_SIGMA).toFixed(6))
      return {
        app_id:    APP_ID,
        time:      t,
        phase:     phase,
        rms_value: noisy,
        measurement: "V" 
      }
    })

    await db.sampledValue.createMany({ data: batchData })

    i++
    await sleep(REAL_SLEEP_MS)
  }
}

main()
  .catch(err => {
    console.error('❌ Stream error:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
