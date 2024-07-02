import GooseSettingList from "@/components/gooseSettings/GooseSettingList";
import NewGooseSettingModal from "@/components/gooseSettings/GooseSettingModal";
import { api } from "@/lib/trpc/api";

export default async function GooseSettings() {
  const { gooseSettings } = await api.gooseSettings.getGooseSettings.query();  

  return (
    <main>
      <div className="flex justify-between">
        <h1 className="font-semibold text-2xl my-2">Goose Settings</h1>
        <NewGooseSettingModal />
      </div>
      <GooseSettingList gooseSettings={gooseSettings} />
    </main>
  );
}
