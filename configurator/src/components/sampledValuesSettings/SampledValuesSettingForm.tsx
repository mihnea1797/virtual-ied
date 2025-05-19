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

// Local form state type
export interface SampledFormState {
  id?: string;
  appId: number;
  ethernetInterface: string;
  dstAddressCheck: boolean;
  threshold: number;
}

export interface SampledValuesSettingsFormProps {
  // Now expecting form state directly
  sampledValuesSettings: SampledFormState;
  networkInterfaces: NetworkInterfaces;
  onChange: (next: SampledFormState) => void;
}

export default function SampledValuesSettingsForm({
  sampledValuesSettings,
  networkInterfaces,
  onChange,
}: SampledValuesSettingsFormProps) {
  const handleField = <K extends keyof SampledFormState>(
    key: K,
    value: SampledFormState[K]
  ) => {
    onChange({ ...sampledValuesSettings, [key]: value });
  };

  return (
    <div className="flex flex-col w-full">
      <h2 className="font-bold text-lg mb-4">Sample Values</h2>
      <div className="space-y-4">
        {/* App ID */}
        <div>
          <label htmlFor="appId" className="block text-sm font-medium mb-1">
            App ID
          </label>
          <Input
            id="appId"
            type="number"
            value={sampledValuesSettings.appId}
            onChange={(e) => handleField("appId", Number(e.target.value))}
          />
        </div>

        {/* Network Interface */}
        <div>
          <label
            htmlFor="ethernetInterface"
            className="block text-sm font-medium mb-1"
          >
            Network Interface
          </label>
          <Select
            value={sampledValuesSettings.ethernetInterface}
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

        {/* DST Address Check */}
        <div className="flex items-center">
          <Checkbox
            id="dstAddressCheck"
            checked={sampledValuesSettings.dstAddressCheck}
            onCheckedChange={(checked) =>
              handleField("dstAddressCheck", Boolean(checked))
            }
          />
          <label
            htmlFor="dstAddressCheck"
            className="ml-2 text-sm font-medium"
          >
            Dst Address Check
          </label>
        </div>

        {/* Threshold */}
        <div>
          <label
            htmlFor="threshold"
            className="block text-sm font-medium mb-1"
          >
            Threshold
          </label>
          <Input
            id="threshold"
            type="number"
            value={sampledValuesSettings.threshold}
            onChange={(e) =>
              handleField("threshold", parseFloat(e.target.value))
            }
          />
        </div>
      </div>
    </div>
  );
}
