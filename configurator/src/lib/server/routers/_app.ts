import { router } from "@/lib/server/trpc";
import { gooseSettingsRouter } from "./gooseSettings";
import { sampledValuesSettingsRouter } from "./sampledValuesSettings";

export const appRouter = router({
  gooseSettings: gooseSettingsRouter,
  sampledValuesSettings: sampledValuesSettingsRouter,
});

export type AppRouter = typeof appRouter;
