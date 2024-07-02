import * as z from "zod"

export const sampledValuesSettingSchema = z.object({
  id: z.string(),
  appId: z.number().int(),
  ethernetInterface: z.string(),
  dstAddressCheck: z.boolean(),
  threshold: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
