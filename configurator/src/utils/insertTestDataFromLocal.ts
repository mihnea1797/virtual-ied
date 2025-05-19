import { db } from '@/lib/db/index'

function parseTimestamp(ts: string): Date {
  const [secStr, msStr, usStr] = ts.split('.')
  const secs = parseInt(secStr, 10)
  const millis = parseInt(msStr, 10)
  const micros = parseInt(usStr, 10)
  const totalMs = secs * 1000 + millis + micros / 1000
  return new Date(totalMs)
}

export async function ingestRMS(batchSize = 4, intervalMs = 1): Promise<void> {
  const [unfilteredRes, filteredRes] = await Promise.all([
    fetch('http://localhost:3000/rms_unfiltered.json'),
    fetch('http://localhost:3000/rms_filtered.json'),
  ])

  if (!unfilteredRes.ok || !filteredRes.ok) {
    throw new Error('❌ Failed to load JSON Data.')
  }

  const unfilteredJson = await unfilteredRes.json() as Array<{ timestamp: string; value: number }>
  const filteredJson = await filteredRes.json() as Array<{ timestamp: string; value: number }>

  const unfilteredRows = unfilteredJson.map(({ timestamp, value }) => ({
    time: parseTimestamp(timestamp),
    value,
  }))
  const filteredRows = filteredJson.map(({ timestamp, value }) => ({
    time: parseTimestamp(timestamp),
    value,
  }))

  const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))

  console.log(`→ Streaming ${unfilteredRows.length} points (unfiltered)`)
  for (let i = 0; i < unfilteredRows.length; i += batchSize) {
    const batch = unfilteredRows.slice(i, i + batchSize).map((row) => ({
      ...row,
      filtered: false,
    }))
    await db.sampledValue.createMany({ data: batch })
    await sleep(intervalMs)
  }
  
  console.log(`→ Streaming ${filteredRows.length} points (filtered)`)
  for (let i = 0; i < filteredRows.length; i += batchSize) {
    const batch = filteredRows.slice(i, i + batchSize).map((row) => ({
      ...row,
      filtered: true,
    }))
    await db.sampledValue.createMany({ data: batch })
    await sleep(intervalMs)
  }
  

  console.log('✅ All test data inserted successfully.')
}
