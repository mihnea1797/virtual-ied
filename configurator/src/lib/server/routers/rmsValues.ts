import { router, publicProcedure } from "@/lib/server/trpc"
import { z } from "zod"
import {
  getAllRmsValues,
  getRmsValueById,
  getRmsValuesSince,
  getLatestRmsValue,
} from "@/lib/api/rmsValues/queries"
import { ingestRMS } from "@/utils/sampleValuesSimulator"
import { db } from '@/lib/db/index'

export const rmsValuesRouter = router({
  ingestRms: publicProcedure
  .mutation(async () => {
    await ingestRMS()
    return { success: true }
  }),
  getAllRmsValues: publicProcedure.query(async () => {
    const rmsValues = await db.sampledValue.findMany({
      where: { filtered: false },
      orderBy: { time: 'asc' },
    })
  
    const filteredValues = await db.sampledValue.findMany({
      where: { filtered: true },
      orderBy: { time: 'asc' },
    })
  
    return { rmsValues, filteredValues }
  }),
  

  getRmsValueById: publicProcedure
    .input(z.number().int())
    .query(async ({ input }) => {
      const row = await getRmsValueById(input)
      return { rmsValue: row }
    }),

  getRmsValuesSince: publicProcedure
    .input(z.object({ since: z.string().datetime() }))
    .query(async ({ input }) => {
      const sinceDate = new Date(input.since)
      const rows = await getRmsValuesSince(sinceDate)
      return { rmsValues: rows }
    }),

  getLatestRmsValue: publicProcedure
    .query(async () => {
      const row = await getLatestRmsValue()
      return { latest: row }
    }),
})
