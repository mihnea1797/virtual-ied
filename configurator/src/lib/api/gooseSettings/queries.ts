import { db } from "@/lib/db/index";
import { type GooseSettingId, gooseSettingIdSchema } from "@/lib/db/schema/gooseSettings";

export const getGooseSettings = async () => {
  const g = await db.gooseSetting.findMany({});
  return { gooseSettings: g };
};

export const getGooseSettingById = async (id: GooseSettingId) => {
  const { id: gooseSettingId } = gooseSettingIdSchema.parse({ id });
  const g = await db.gooseSetting.findFirst({
    where: { id: gooseSettingId}});
  return { gooseSetting: g };
};


