import { db } from "@/lib/db/index"
import type { SampledValue } from "@prisma/client"

export async function getAllRmsValues(): Promise<SampledValue[]> {
  return db.sampledValue.findMany({
    orderBy: { time: 'asc' },
  })
}

export async function getRmsValueById(
  id: number
): Promise<SampledValue | null> {
  return db.sampledValue.findUnique({
    where: { id },
  })
}

export async function getRmsValuesSince(
  since: Date
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
