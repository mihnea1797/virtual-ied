import {
    getAllGooseSettings
} from "@/lib/api/gooseSettings/queries";
import { timestamps } from "@/lib/utils";
import { GooseSettingSchema } from "@/zodAutoGenSchemas";
import { z } from "zod";

// Schema for gooseSettings - used to validate API requests
const baseSchema = GooseSettingSchema.omit(timestamps);

export const insertGooseSettingSchema = baseSchema.omit({ id: true });
export const insertGooseSettingParams = baseSchema
    .extend({
        vlanPriority: z.coerce.number(),
        vlanId: z.coerce.number(),
        appId: z.coerce.number(),
        useVlanTag: z.coerce.boolean(),
        timeAllowedToLive: z.coerce.number(),
        simulation: z.coerce.boolean(),
        confRev: z.coerce.number(),
        ndsCom: z.coerce.boolean(),
    })
    .omit({
        id: true,
    });

export const updateGooseSettingSchema = baseSchema;
export const updateGooseSettingParams = updateGooseSettingSchema.extend({
    vlanPriority: z.coerce.number(),
    vlanId: z.coerce.number(),
    appId: z.coerce.number(),
    useVlanTag: z.coerce.boolean(),
    timeAllowedToLive: z.coerce.number(),
    simulation: z.coerce.boolean(),
    confRev: z.coerce.number(),
    ndsCom: z.coerce.boolean(),
});
export const gooseSettingIdSchema = baseSchema.pick({ id: true });

// Types for gooseSettings - used to type API request params and within Components
export type GooseSettings = z.infer<typeof GooseSettingSchema>;
export type NewGooseSetting = z.infer<typeof insertGooseSettingSchema>;
export type NewGooseSettingParams = z.infer<typeof insertGooseSettingParams>;
export type UpdateGooseSettingParams = z.infer<typeof updateGooseSettingParams>;
export type GooseSettingId = z.infer<typeof gooseSettingIdSchema>["id"];

// this type infers the return from getAllGooseSettings() - meaning it will include any joins
export type CompleteGooseSetting = Awaited<
    ReturnType<typeof getAllGooseSettings>
>["gooseSettings"][number];
