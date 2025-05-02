import AddConfigFileButton from "@/components/AddConfigFileButton";
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
        vIED Settings
      </h1>
      <AddConfigFileButton />
      <Tabs
        defaultValue="settings"
        className="flex flex-col flex-grow overflow-hidden"
      >
        <TabsContent
          value="settings"
          className="flex gap-8 overflow-y-auto p-1"
        >
          <GooseSettingsForm
            gooseSettings={gooseSettings}
            networkInterfaces={networkInterfaces}
          />
          <SampledValuesSettingsForm
            sampledValuesSettings={sampledValuesSettings}
            networkInterfaces={networkInterfaces}
          />
        </TabsContent>
      </Tabs>

    </main>
  );
}
