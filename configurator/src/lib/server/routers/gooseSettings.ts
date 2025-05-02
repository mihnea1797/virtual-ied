import {
    createGooseSetting,
    deleteGooseSetting,
    updateGooseSetting,
} from "@/lib/api/gooseSettings/mutations";
import {
    getAllGooseSettings,
    getGooseSettingById,
    getGooseSettings,
} from "@/lib/api/gooseSettings/queries";
import { startMergingUnit, stopMergingUnit } from "@/lib/api/merging-unit/main";
import {
    gooseSettingIdSchema,
    insertGooseSettingParams,
    updateGooseSettingParams,
} from "@/lib/db/schema/gooseSettings";
import { publicProcedure, router } from "@/lib/server/trpc";

export const gooseSettingsRouter = router({
    getGooseSettings: publicProcedure.query(async () => {
        return getGooseSettings();
    }),
    getAllGooseSettings: publicProcedure.query(async () => {
        return getAllGooseSettings();
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
    startMergingUnit: publicProcedure
    .input((x) => x) 
    .mutation(async ({ input }) => {
    return startMergingUnit(input);
    }),
    stopMergingUnit: publicProcedure.mutation(async () => {
        return stopMergingUnit();
    }),
});
