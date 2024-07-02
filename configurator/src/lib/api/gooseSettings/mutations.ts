import { db } from "@/lib/db/index";
import { 
  GooseSettingId, 
  NewGooseSettingParams,
  UpdateGooseSettingParams, 
  updateGooseSettingSchema,
  insertGooseSettingSchema, 
  gooseSettingIdSchema 
} from "@/lib/db/schema/gooseSettings";

export const createGooseSetting = async (gooseSetting: NewGooseSettingParams) => {
  const newGooseSetting = insertGooseSettingSchema.parse(gooseSetting);
  try {
    const g = await db.gooseSetting.create({ data: newGooseSetting });
    return { gooseSetting: g };
  } catch (err) {
    const message = (err as Error).message ?? "Error, please try again";
    console.error(message);
    throw { error: message };
  }
};

export const updateGooseSetting = async (id: GooseSettingId, gooseSetting: UpdateGooseSettingParams) => {
  const { id: gooseSettingId } = gooseSettingIdSchema.parse({ id });
  const newGooseSetting = updateGooseSettingSchema.parse(gooseSetting);
  try {
    const g = await db.gooseSetting.update({ where: { id: gooseSettingId }, data: newGooseSetting})
    return { gooseSetting: g };
  } catch (err) {
    const message = (err as Error).message ?? "Error, please try again";
    console.error(message);
    throw { error: message };
  }
};

export const deleteGooseSetting = async (id: GooseSettingId) => {
  const { id: gooseSettingId } = gooseSettingIdSchema.parse({ id });
  try {
    const g = await db.gooseSetting.delete({ where: { id: gooseSettingId }})
    return { gooseSetting: g };
  } catch (err) {
    const message = (err as Error).message ?? "Error, please try again";
    console.error(message);
    throw { error: message };
  }
};

