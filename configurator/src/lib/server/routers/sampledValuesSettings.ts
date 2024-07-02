import { getSampledValuesSettingById, getSampledValuesSettings } from "@/lib/api/sampledValuesSettings/queries";
import { publicProcedure, router } from "@/lib/server/trpc";
import {
  sampledValuesSettingIdSchema,
  insertSampledValuesSettingParams,
  updateSampledValuesSettingParams,
} from "@/lib/db/schema/sampledValuesSettings";
import { createSampledValuesSetting, deleteSampledValuesSetting, updateSampledValuesSetting } from "@/lib/api/sampledValuesSettings/mutations";

export const sampledValuesSettingsRouter = router({
  getSampledValuesSettings: publicProcedure.query(async () => {
    return getSampledValuesSettings();
  }),
  getSampledValuesSettingById: publicProcedure.input(sampledValuesSettingIdSchema).query(async ({ input }) => {
    return getSampledValuesSettingById(input.id);
  }),
  createSampledValuesSetting: publicProcedure
    .input(insertSampledValuesSettingParams)
    .mutation(async ({ input }) => {
      return createSampledValuesSetting(input);
    }),
  updateSampledValuesSetting: publicProcedure
    .input(updateSampledValuesSettingParams)
    .mutation(async ({ input }) => {
      return updateSampledValuesSetting(input.id, input);
    }),
  deleteSampledValuesSetting: publicProcedure
    .input(sampledValuesSettingIdSchema)
    .mutation(async ({ input }) => {
      return deleteSampledValuesSetting(input.id);
    }),
});
