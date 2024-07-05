import { router } from "@/lib/server/trpc";
import { gooseSettingsRouter } from "./gooseSettings";
import { sampledValuesSettingsRouter } from "./sampledValuesSettings";
import { networkInterfacesRouter } from "./networkInterfaces";

export const appRouter = router({
    gooseSettings: gooseSettingsRouter,
    sampledValuesSettings: sampledValuesSettingsRouter,
    networkInterfaces: networkInterfacesRouter,
});

export type AppRouter = typeof appRouter;
