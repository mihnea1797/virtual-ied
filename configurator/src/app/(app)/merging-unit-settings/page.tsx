"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import AddConfigFileButton from "@/components/ui/AddConfigFileButton";
import GooseSettingsForm from "@/components/gooseSettings/GooseSettingsForm";
import SampledValuesSettingsForm, { SampledFormState } from "@/components/sampledValuesSettings/SampledValuesSettingForm";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";

export interface GooseFormState {
  id?: string;
  vlanPriority: number;
  vlanId: number;
  appId: number;
  dstAddress: string | null;
  ethernetInterface: string;
  useVlanTag: boolean;
  goId: string;
  goCb: string;
  timeAllowedToLive: number;
  dataSetRef: string;
  simulation: boolean;
  confRev: number;
  ndsCom: boolean;
}

const defaultGooseState: GooseFormState = {
  vlanPriority: 0,
  vlanId: 0,
  appId: 0,
  dstAddress: "",
  ethernetInterface: "",
  useVlanTag: false,
  goId: "",
  goCb: "",
  timeAllowedToLive: 0,
  dataSetRef: "",
  simulation: false,
  confRev: 0,
  ndsCom: false,
};

export default function MergingUnitSettingsPage() {
  const router = useRouter();
  const utils = trpc.useContext();

  const { data: gooseData, isLoading: loadingGoose } =
    trpc.gooseSettings.getGooseSettings.useQuery();
  const { data: sampledData, isLoading: loadingSampled } =
    trpc.sampledValuesSettings.getSampledValuesSettings.useQuery();
  const { data: networkData, isLoading: loadingNics } =
    trpc.networkInterfaces.getNetworkInterfaces.useQuery();

  const initialGoose = gooseData?.gooseSettings ?? null;
  const initialSampled = sampledData?.sampledValuesSettings ?? null;
  const nics = networkData?.networkInterfaces ?? [];

  const defaultSampledState: SampledFormState = {
    appId: 0,
    ethernetInterface: "",
    dstAddressCheck: false,
    threshold: 0,
  };

  const initialGooseState = useMemo<GooseFormState>(() => {
    return initialGoose
      ? {
        id: initialGoose.id,
        vlanPriority: initialGoose.vlanPriority,
        vlanId: initialGoose.vlanId,
        appId: initialGoose.appId,
        dstAddress: initialGoose.dstAddress,
        ethernetInterface: initialGoose.ethernetInterface,
        useVlanTag: initialGoose.useVlanTag ?? false,
        goId: initialGoose.goId,
        goCb: initialGoose.goCb,
        timeAllowedToLive: initialGoose.timeAllowedToLive ?? 0,
        dataSetRef: initialGoose.dataSetRef ?? "",
        simulation: initialGoose.simulation ?? false,
        confRev: initialGoose.confRev ?? 0,
        ndsCom: initialGoose.ndsCom ?? false,
      }
      : defaultGooseState;
  }, [initialGoose]);

  const initialSampledState = useMemo<SampledFormState>(() => {
    return initialSampled
      ? {
        id: initialSampled.id,
        appId: initialSampled.appId,
        ethernetInterface: initialSampled.ethernetInterface,
        dstAddressCheck: initialSampled.dstAddressCheck,
        threshold: initialSampled.threshold,
      }
      : defaultSampledState;
  }, [initialSampled]);

  const [gooseState, setGooseState] = useState<GooseFormState>(initialGooseState);
  const [sampledState, setSampledState] = useState<SampledFormState>(initialSampledState);

  useEffect(() => {
    setGooseState(initialGooseState);
  }, [initialGooseState]);
  useEffect(() => {
    setSampledState(initialSampledState);
  }, [initialSampledState]);

  const gooseCreate = trpc.gooseSettings.createGooseSetting.useMutation();
  const gooseUpdate = trpc.gooseSettings.updateGooseSetting.useMutation();
  const gooseDelete = trpc.gooseSettings.deleteGooseSetting.useMutation();
  const sampledCreate = trpc.sampledValuesSettings.createSampledValuesSetting.useMutation();
  const sampledUpdate = trpc.sampledValuesSettings.updateSampledValuesSetting.useMutation();
  const sampledDelete = trpc.sampledValuesSettings.deleteSampledValuesSetting.useMutation();

  async function handleSaveSettings() {
    try {
      // Goose
      if (gooseState) {
        if (gooseState.id) {
          await gooseUpdate.mutateAsync({ id: gooseState.id, ...gooseState });
        } else {
          await gooseCreate.mutateAsync(gooseState);
        }
      }
      // Sampled
      if (sampledState) {
        if (sampledState.id) {
          await sampledUpdate.mutateAsync({ id: sampledState.id, ...sampledState });
        } else {
          await sampledCreate.mutateAsync(sampledState);
        }
      }
      await utils.gooseSettings.getGooseSettings.invalidate();
      await utils.sampledValuesSettings.getSampledValuesSettings.invalidate();
      router.refresh();
      toast.success("All settings saved!");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save settings");
    }
  }


  async function handleRemoveSettings() {
    try {
      if (sampledState.id) {
        await sampledDelete.mutateAsync({ id: sampledState.id });
        setSampledState(defaultSampledState);
      }
      if (gooseState.id) {
        await gooseDelete.mutateAsync({ id: gooseState.id });
        setGooseState(defaultGooseState);
      }
      await utils.gooseSettings.getGooseSettings.invalidate();
      await utils.sampledValuesSettings.getSampledValuesSettings.invalidate();
      router.refresh();
      toast.success("Settings removed");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to remove settings");
    }
  }

  const isSaving =
    gooseCreate.isLoading ||
    gooseUpdate.isLoading ||
    sampledCreate.isLoading ||
    sampledUpdate.isLoading;
  const isDeleting = gooseDelete.isLoading || sampledDelete.isLoading;

  if (loadingGoose || loadingSampled || loadingNics) {
    return <div>Loading...</div>;
  }

  return (
    <main className="flex flex-col p-8 gap-y-4 h-screen">
      <h1 className="text-2xl font-semibold">vIED Settings</h1>
      <AddConfigFileButton />

      <Tabs defaultValue="settings" className="flex flex-col flex-grow overflow-hidden">


        <TabsContent value="settings" className="flex gap-8 overflow-y-auto p-1">
          <GooseSettingsForm
            gooseSettings={gooseState}
            networkInterfaces={nics}
            onChange={setGooseState}
          />
          <SampledValuesSettingsForm
            sampledValuesSettings={sampledState}
            networkInterfaces={nics}
            onChange={setSampledState}
          />
        </TabsContent>
      </Tabs>

      <div className="flex gap-2 mt-4">
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
        <Button
          type="button"
          className="bg-red-500 hover:bg-red-400 text-white"
          onClick={handleRemoveSettings}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </main>
  );
}
