import { db } from "@/lib/db/index"
import type { SampledValue } from "@prisma/client"

export async function getAllRmsValues(
  limit: number = 400000
): Promise<SampledValue[]> {
  const rows = await db.sampledValue.findMany({
    orderBy: { time: 'desc' },
    take: limit,
  })
  return rows.reverse()
}

export async function getRmsValueById(
  id: number
): Promise<SampledValue[]> {
  return db.sampledValue.findMany({
    where: { id },
    orderBy: { time: 'desc' }
  })
}

export async function getRmsValuesSince(
  since: Date,
): Promise<SampledValue[]> {
  return db.sampledValue.findMany({
    where: { time: { gt: since } },
    orderBy: { time: 'asc' },
  })
}

export async function getLatestRmsValue(): Promise<SampledValue | null> {
  return db.sampledValue.findFirst({
    orderBy: { time: 'desc' },
  })
}

export async function getRecentRmsValues(
  count: number
): Promise<SampledValue[]> {
  return db.sampledValue.findMany({
    orderBy: { time: 'desc' },
    take: count,
  })
}
