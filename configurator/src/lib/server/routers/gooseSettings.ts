import {
    getGooseSettingById,
    getGooseSettings,
} from "@/lib/api/gooseSettings/queries";
import { publicProcedure, router } from "@/lib/server/trpc";
import {
    gooseSettingIdSchema,
    insertGooseSettingParams,
    updateGooseSettingParams,
} from "@/lib/db/schema/gooseSettings";
import {
    createGooseSetting,
    deleteGooseSetting,
    updateGooseSetting,
} from "@/lib/api/gooseSettings/mutations";
import { startMergingUnit, stopMergingUnit } from "@/lib/api/merging-unit/main";

export const gooseSettingsRouter = router({
    getGooseSettings: publicProcedure.query(async () => {
        return getGooseSettings();
    }),
    getGooseSettingById: publicProcedure
        .input(gooseSettingIdSchema)
        .query(async ({ input }) => {
            return getGooseSettingById(input.id);
        }),
    createGooseSetting: publicProcedure
        .input(insertGooseSettingParams)
        .mutation(async ({ input }) => {
            return createGooseSetting(input);
        }),
    updateGooseSetting: publicProcedure
        .input(updateGooseSettingParams)
        .mutation(async ({ input }) => {
            return updateGooseSetting(input.id, input);
        }),
    deleteGooseSetting: publicProcedure
        .input(gooseSettingIdSchema)
        .mutation(async ({ input }) => {
            return deleteGooseSetting(input.id);
        }),
    startMergingUnit: publicProcedure.mutation(async () => {
        return startMergingUnit();
    }),
    stopMergingUnit: publicProcedure.mutation(async () => {
        return stopMergingUnit();
    }),
});
