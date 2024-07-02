"use client";
import { CompleteSampledValuesSetting } from "@/lib/db/schema/sampledValuesSettings";
import { trpc } from "@/lib/trpc/client";
import SampledValuesSettingModal from "./SampledValuesSettingModal";


export default function SampledValuesSettingList({ sampledValuesSettings }: { sampledValuesSettings: CompleteSampledValuesSetting[] }) {
  const { data: s } = trpc.sampledValuesSettings.getSampledValuesSettings.useQuery(undefined, {
    initialData: { sampledValuesSettings },
    refetchOnMount: false,
  });

  if (s.sampledValuesSettings.length === 0) {
    return <EmptyState />;
  }

  return (
    <ul>
      {s.sampledValuesSettings.map((sampledValuesSetting) => (
        <SampledValuesSetting sampledValuesSetting={sampledValuesSetting} key={sampledValuesSetting.id} />
      ))}
    </ul>
  );
}

const SampledValuesSetting = ({ sampledValuesSetting }: { sampledValuesSetting: CompleteSampledValuesSetting }) => {
  return (
    <li className="flex justify-between my-2">
      <div className="w-full">
        <div>{sampledValuesSetting.appId}</div>
      </div>
      <SampledValuesSettingModal sampledValuesSetting={sampledValuesSetting} />
    </li>
  );
};

const EmptyState = () => {
  return (
    <div className="text-center">
      <h3 className="mt-2 text-sm font-semibold text-secondary-foreground">
        No sampled values settings
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Get started by creating a new sampled values setting.
      </p>
      <div className="mt-6">
        <SampledValuesSettingModal emptyState={true} />
      </div>
    </div>
  );
};

