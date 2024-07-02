import { sampledValuesSettingSchema } from "@/zodAutoGenSchemas";
import { z } from "zod";
import { timestamps } from "@/lib/utils";
import { getSampledValuesSettings } from "@/lib/api/sampledValuesSettings/queries";


// Schema for sampledValuesSettings - used to validate API requests
const baseSchema = sampledValuesSettingSchema.omit(timestamps)

export const insertSampledValuesSettingSchema = baseSchema.omit({ id: true });
export const insertSampledValuesSettingParams = baseSchema.extend({
  appId: z.coerce.number(),
  dstAddressCheck: z.coerce.boolean(),
  threshold: z.coerce.number()
}).omit({ 
  id: true
});

export const updateSampledValuesSettingSchema = baseSchema;
export const updateSampledValuesSettingParams = updateSampledValuesSettingSchema.extend({
  appId: z.coerce.number(),
  dstAddressCheck: z.coerce.boolean(),
  threshold: z.coerce.number()
})
export const sampledValuesSettingIdSchema = baseSchema.pick({ id: true });

// Types for sampledValuesSettings - used to type API request params and within Components
export type SampledValuesSetting = z.infer<typeof sampledValuesSettingSchema>;
export type NewSampledValuesSetting = z.infer<typeof insertSampledValuesSettingSchema>;
export type NewSampledValuesSettingParams = z.infer<typeof insertSampledValuesSettingParams>;
export type UpdateSampledValuesSettingParams = z.infer<typeof updateSampledValuesSettingParams>;
export type SampledValuesSettingId = z.infer<typeof sampledValuesSettingIdSchema>["id"];
    
// this type infers the return from getSampledValuesSettings() - meaning it will include any joins
export type CompleteSampledValuesSetting = Awaited<ReturnType<typeof getSampledValuesSettings>>["sampledValuesSettings"][number];

