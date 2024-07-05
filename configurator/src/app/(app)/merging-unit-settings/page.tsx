import GooseSettingsForm from "@/components/gooseSettings/GooseSettingsForm";
import SampledValuesSettingsForm from "@/components/sampledValuesSettings/SampledValuesSettingForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/trpc/api";

export default async function MergingUnitSettingsPage() {
    const { gooseSettings } = await api.gooseSettings.getGooseSettings.query();
    const { sampledValuesSettings } =
        await api.sampledValuesSettings.getSampledValuesSettings.query();
    const { networkInterfaces } =
        await api.networkInterfaces.getNetworkInterfaces.query();

    return (
        <main className="flex flex-col flex-grow p-8 gap-y-3 h-screen">
            <h1 className="font-semibold text-2xl my-2">
                Merging Unit Settings
            </h1>
            <Tabs
                defaultValue="goose"
                className="flex flex-col flex-grow overflow-hidden"
            >
                <TabsList className="grid w-1/4 grid-cols-2">
                    <TabsTrigger value="goose">Goose</TabsTrigger>
                    <TabsTrigger value="sampledValues">
                        Sampled Values
                    </TabsTrigger>
                </TabsList>
                <TabsContent
                    value="goose"
                    className="flex-grow overflow-y-auto p-1"
                >
                    <GooseSettingsForm
                        gooseSettings={gooseSettings}
                        networkInterfaces={networkInterfaces}
                    />
                </TabsContent>
                <TabsContent
                    value="sampledValues"
                    className="flex-grow overflow-y-auto p-1"
                >
                    <SampledValuesSettingsForm
                        sampledValuesSettings={sampledValuesSettings}
                        networkInterfaces={networkInterfaces}
                    />
                </TabsContent>
            </Tabs>
        </main>
    );
}
