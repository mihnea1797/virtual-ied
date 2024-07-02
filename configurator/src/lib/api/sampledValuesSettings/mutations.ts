import { db } from "@/lib/db/index";
import { 
  SampledValuesSettingId, 
  NewSampledValuesSettingParams,
  UpdateSampledValuesSettingParams, 
  updateSampledValuesSettingSchema,
  insertSampledValuesSettingSchema, 
  sampledValuesSettingIdSchema 
} from "@/lib/db/schema/sampledValuesSettings";

export const createSampledValuesSetting = async (sampledValuesSetting: NewSampledValuesSettingParams) => {
  const newSampledValuesSetting = insertSampledValuesSettingSchema.parse(sampledValuesSetting);
  try {
    const s = await db.sampledValuesSetting.create({ data: newSampledValuesSetting });
    return { sampledValuesSetting: s };
  } catch (err) {
    const message = (err as Error).message ?? "Error, please try again";
    console.error(message);
    throw { error: message };
  }
};

export const updateSampledValuesSetting = async (id: SampledValuesSettingId, sampledValuesSetting: UpdateSampledValuesSettingParams) => {
  const { id: sampledValuesSettingId } = sampledValuesSettingIdSchema.parse({ id });
  const newSampledValuesSetting = updateSampledValuesSettingSchema.parse(sampledValuesSetting);
  try {
    const s = await db.sampledValuesSetting.update({ where: { id: sampledValuesSettingId }, data: newSampledValuesSetting})
    return { sampledValuesSetting: s };
  } catch (err) {
    const message = (err as Error).message ?? "Error, please try again";
    console.error(message);
    throw { error: message };
  }
};

export const deleteSampledValuesSetting = async (id: SampledValuesSettingId) => {
  const { id: sampledValuesSettingId } = sampledValuesSettingIdSchema.parse({ id });
  try {
    const s = await db.sampledValuesSetting.delete({ where: { id: sampledValuesSettingId }})
    return { sampledValuesSetting: s };
  } catch (err) {
    const message = (err as Error).message ?? "Error, please try again";
    console.error(message);
    throw { error: message };
  }
};

