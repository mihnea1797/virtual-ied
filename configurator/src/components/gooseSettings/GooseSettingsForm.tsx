"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import NetworkInterfaceCard from "../networkInterfaces/NetworkInterfaceCard";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select";
import { NetworkInterfaces } from "@/lib/api/networkInterfaces/queries";

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

export interface GooseSettingsFormProps {
  gooseSettings: GooseFormState;
  networkInterfaces: NetworkInterfaces;
  onChange: (next: GooseFormState) => void;
}

export default function GooseSettingsForm({
  gooseSettings,
  networkInterfaces,
  onChange,
}: GooseSettingsFormProps) {
  const handleField = <K extends keyof GooseFormState>(
    key: K,
    value: GooseFormState[K]
  ) => {
    onChange({ ...gooseSettings, [key]: value });
  };

  return (
    <div className="flex flex-col w-full">
      <h2 className="font-bold text-lg mb-4">Goose</h2>
      <div className="space-y-4">
        {/* VLAN Priority */}
        <div>
          <label htmlFor="vlanPriority" className="block text-sm font-medium mb-1">
            VLAN Priority
          </label>
          <Input
            id="vlanPriority"
            type="number"
            value={gooseSettings.vlanPriority}
            onChange={(e) => handleField("vlanPriority", Number(e.target.value))}
          />
        </div>
        {/* VLAN ID */}
        <div>
          <label htmlFor="vlanId" className="block text-sm font-medium mb-1">
            VLAN ID
          </label>
          <Input
            id="vlanId"
            type="number"
            value={gooseSettings.vlanId}
            onChange={(e) => handleField("vlanId", Number(e.target.value))}
          />
        </div>
        {/* App ID */}
        <div>
          <label htmlFor="appId" className="block text-sm font-medium mb-1">
            App ID
          </label>
          <Input
            id="appId"
            type="number"
            value={gooseSettings.appId}
            onChange={(e) => handleField("appId", Number(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor="dstAddress" className="block text-sm font-medium mb-1">
            Destination Address
          </label>
          <Input
            id="dstAddress"
            type="text"
            value={gooseSettings.dstAddress || ""}
            onChange={(e) => handleField("dstAddress", e.target.value)}
          />
        </div>
        {/* Network Interface */}
        <div>
          <label htmlFor="ethernetInterface" className="block text-sm font-medium mb-1">
            Network Interface
          </label>
          <Select
            value={gooseSettings.ethernetInterface}
            onValueChange={(val) => handleField("ethernetInterface", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select interface" />
            </SelectTrigger>
            <SelectContent>
              {networkInterfaces.map((nic) => (
                <SelectItem key={nic.name} value={nic.name}>
                  <NetworkInterfaceCard networkInterface={nic} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Use VLAN Tag */}
        <div className="flex items-center">
          <Checkbox
            id="useVlanTag"
            checked={gooseSettings.useVlanTag}
            onCheckedChange={(c) => handleField("useVlanTag", Boolean(c))}
          />
          <label htmlFor="useVlanTag" className="ml-2 text-sm font-medium">
            Use VLAN Tag
          </label>
        </div>
        {/* Go ID */}
        <div>
          <label htmlFor="goId" className="block text-sm font-medium mb-1">
            Go ID
          </label>
          <Input
            id="goId"
            type="text"
            value={gooseSettings.goId}
            onChange={(e) => handleField("goId", e.target.value)}
          />
        </div>
        {/* Go CB */}
        <div>
          <label htmlFor="goCb" className="block text-sm font-medium mb-1">
            Go CB
          </label>
          <Input
            id="goCb"
            type="text"
            value={gooseSettings.goCb}
            onChange={(e) => handleField("goCb", e.target.value)}
          />
        </div>
        {/* Time Allowed To Live */}
        <div>
          <label htmlFor="timeAllowedToLive" className="block text-sm font-medium mb-1">
            Time Allowed To Live
          </label>
          <Input
            id="timeAllowedToLive"
            type="number"
            value={gooseSettings.timeAllowedToLive}
            onChange={(e) => handleField("timeAllowedToLive", Number(e.target.value))}
          />
        </div>
        {/* DataSetRef */}
        <div>
          <label htmlFor="dataSetRef" className="block text-sm font-medium mb-1">
            Data Set Ref
          </label>
          <Input
            id="dataSetRef"
            type="text"
            value={gooseSettings.dataSetRef}
            onChange={(e) => handleField("dataSetRef", e.target.value)}
          />
        </div>
        {/* Simulation */}
        <div className="flex items-center">
          <Checkbox
            id="simulation"
            checked={gooseSettings.simulation}
            onCheckedChange={(c) => handleField("simulation", Boolean(c))}
          />
          <label htmlFor="simulation" className="ml-2 text-sm font-medium">
            Simulation
          </label>
        </div>
        {/* ConfRev */}
        <div>
          <label htmlFor="confRev" className="block text-sm font-medium mb-1">
            Conf Rev
          </label>
          <Input
            id="confRev"
            type="number"
            value={gooseSettings.confRev}
            onChange={(e) => handleField("confRev", Number(e.target.value))}
          />
        </div>
        {/* NdsCom */}
        <div className="flex items-center">
          <Checkbox
            id="ndsCom"
            checked={gooseSettings.ndsCom}
            onCheckedChange={(c) => handleField("ndsCom", Boolean(c))}
          />
          <label htmlFor="ndsCom" className="ml-2 text-sm font-medium">
            NDS Com
          </label>
        </div>
      </div>
    </div>
  );
}
