"use client";
import { CompleteGooseSetting } from "@/lib/db/schema/gooseSettings";
import { trpc } from "@/lib/trpc/client";
import GooseSettingModal from "./GooseSettingModal";


export default function GooseSettingList({ gooseSettings }: { gooseSettings: CompleteGooseSetting[] }) {
  const { data: g } = trpc.gooseSettings.getGooseSettings.useQuery(undefined, {
    initialData: { gooseSettings },
    refetchOnMount: false,
  });

  if (g.gooseSettings.length === 0) {
    return <EmptyState />;
  }

  return (
    <ul>
      {g.gooseSettings.map((gooseSetting) => (
        <GooseSetting gooseSetting={gooseSetting} key={gooseSetting.id} />
      ))}
    </ul>
  );
}

const GooseSetting = ({ gooseSetting }: { gooseSetting: CompleteGooseSetting }) => {
  return (
    <li className="flex justify-between my-2">
      <div className="w-full">
        <div>{gooseSetting.vlanPriority}</div>
      </div>
      <GooseSettingModal gooseSetting={gooseSetting} />
    </li>
  );
};

const EmptyState = () => {
  return (
    <div className="text-center">
      <h3 className="mt-2 text-sm font-semibold text-secondary-foreground">
        No goose settings
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Get started by creating a new goose setting.
      </p>
      <div className="mt-6">
        <GooseSettingModal emptyState={true} />
      </div>
    </div>
  );
};

