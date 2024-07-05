import { getNetworkInterfaces } from "@/lib/api/networkInterfaces/queries";
import { publicProcedure, router } from "@/lib/server/trpc";

export const networkInterfacesRouter = router({
    getNetworkInterfaces: publicProcedure.query(async () => {
        return getNetworkInterfaces();
    }),
});
