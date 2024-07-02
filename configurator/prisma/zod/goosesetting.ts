import * as z from "zod"

export const gooseSettingSchema = z.object({
  id: z.string(),
  vlanPriority: z.number().int(),
  vlanId: z.number().int(),
  appId: z.number().int(),
  dstAddress: z.string().nullish(),
  ethernetInterface: z.string(),
  useVlanTag: z.boolean().nullish(),
  goId: z.string(),
  goCb: z.string(),
  timeAllowedToLive: z.number().int(),
  dataSetRef: z.string(),
  simulation: z.boolean().nullish(),
  confRev: z.number().int(),
  ndsCom: z.boolean().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
