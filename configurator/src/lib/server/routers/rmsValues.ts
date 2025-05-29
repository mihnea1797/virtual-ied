import { router, publicProcedure } from "@/lib/server/trpc"
import { z } from "zod"
import {
  getRmsValueById,
  getRecentRmsValues,
  getLatestRmsValue,
} from "@/lib/api/rmsValues/queries"
import { ingestRMS } from "@/utils/insertTestDataFromLocal"

export const rmsValuesRouter = router({
  ingestRms: publicProcedure
    .mutation(async () => {
      await ingestRMS()
      return { success: true }
    }),

  // Fetch the most recent N RMS measurements
  getRecentRmsValues: publicProcedure
    .input(z.number().int().min(1))
    .query(async ({ input }) => {
      const rows = await getRecentRmsValues(input)
      return { rmsValues: rows }
    }),

  getRmsValueById: publicProcedure
    .input(z.number().int())
    .query(async ({ input }) => {
      const row = await getRmsValueById(input)
      return { rmsValue: row }
    }),

  getLatestRmsValue: publicProcedure
    .query(async () => {
      const row = await getLatestRmsValue()
      return { latest: row }
    }),
})
