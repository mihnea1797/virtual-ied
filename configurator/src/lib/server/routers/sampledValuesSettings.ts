import {
    createSampledValuesSetting,
    deleteSampledValuesSetting,
    updateSampledValuesSetting,
} from "@/lib/api/sampledValuesSettings/mutations";
import {
    getAllSampledValuesSettings,
    getSampledValuesSettingById,
    getSampledValuesSettings,
} from "@/lib/api/sampledValuesSettings/queries";
import {
    insertSampledValuesSettingParams,
    sampledValuesSettingIdSchema,
    updateSampledValuesSettingParams,
} from "@/lib/db/schema/sampledValuesSettings";
import { publicProcedure, router } from "@/lib/server/trpc";

export const sampledValuesSettingsRouter = router({
    getSampledValuesSettings: publicProcedure.query(async () => {
        return getSampledValuesSettings();
    }),
    getAllSampledValuesSettings: publicProcedure.query(async () => {
        return getAllSampledValuesSettings();
    }),
    getSampledValuesSettingById: publicProcedure
        .input(sampledValuesSettingIdSchema)
        .query(async ({ input }) => {
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
