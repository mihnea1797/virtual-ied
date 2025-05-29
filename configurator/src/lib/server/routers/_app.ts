import { router } from "@/lib/server/trpc"
import { gooseSettingsRouter } from "./gooseSettings"
import { sampledValuesSettingsRouter } from "./sampledValuesSettings"
import { networkInterfacesRouter } from "./networkInterfaces"
import { rmsValuesRouter } from "./rmsValues"

export const appRouter = router({
  gooseSettings: gooseSettingsRouter,
  sampledValuesSettings: sampledValuesSettingsRouter,
  networkInterfaces: networkInterfacesRouter,
  rmsValues:   rmsValuesRouter,
})

export type AppRouter = typeof appRouter
