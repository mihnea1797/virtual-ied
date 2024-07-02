import SampledValuesSettingList from "@/components/sampledValuesSettings/SampledValuesSettingList";
import NewSampledValuesSettingModal from "@/components/sampledValuesSettings/SampledValuesSettingModal";
import { api } from "@/lib/trpc/api";

export default async function SampledValuesSettings() {
  const { sampledValuesSettings } = await api.sampledValuesSettings.getSampledValuesSettings.query();  

  return (
    <main>
      <div className="flex justify-between">
        <h1 className="font-semibold text-2xl my-2">Sampled Values Settings</h1>
        <NewSampledValuesSettingModal />
      </div>
      <SampledValuesSettingList sampledValuesSettings={sampledValuesSettings} />
    </main>
  );
}
