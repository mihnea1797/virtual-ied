import { db } from "@/lib/db/index";
import {
    type SampledValuesSettingId,
    sampledValuesSettingIdSchema,
} from "@/lib/db/schema/sampledValuesSettings";

export const getSampledValuesSettings = async () => {
    const s = await db.sampledValuesSetting.findFirst();
    return { sampledValuesSettings: s };
};

export const getAllSampledValuesSettings = async () => {
    const s = await db.sampledValuesSetting.findMany({});
    return { sampledValuesSettings: s };
};

export const getSampledValuesSettingById = async (
    id: SampledValuesSettingId
) => {
    const { id: sampledValuesSettingId } = sampledValuesSettingIdSchema.parse({
        id,
    });
    const s = await db.sampledValuesSetting.findFirst({
        where: { id: sampledValuesSettingId },
    });
    return { sampledValuesSetting: s };
};
