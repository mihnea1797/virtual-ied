"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NetworkInterfaces } from "@/lib/api/networkInterfaces/queries";
import {
    NewSampledValuesSettingParams,
    SampledValuesSettings,
    insertSampledValuesSettingParams,
} from "@/lib/db/schema/sampledValuesSettings";
import { trpc } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import NetworkInterfaceCard from "../networkInterfaces/NetworkInterfaceCard";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

type SampledValuesSettingsFormProps = {
    sampledValuesSettings: SampledValuesSettings | null;
    networkInterfaces: NetworkInterfaces | null;
};

export default function SampledValuesSettingsForm({
    sampledValuesSettings,
    networkInterfaces,
}: SampledValuesSettingsFormProps) {
    const editing = !!sampledValuesSettings?.id;

    const router = useRouter();
    const utils = trpc.useUtils();

    const form = useForm<z.infer<typeof insertSampledValuesSettingParams>>({
        // latest Zod release has introduced a TS error with zodResolver
        // open issue: https://github.com/colinhacks/zod/issues/2663
        // errors locally but not in production
        resolver: zodResolver(insertSampledValuesSettingParams),
        defaultValues: sampledValuesSettings ?? {
            appId: 0,
            ethernetInterface: "",
            dstAddressCheck: false,
            threshold: 0.0,
        },
    });

    const onSuccess = async (
        action: "create" | "update" | "delete",
        data?: { error?: string }
    ) => {
        if (data?.error) {
            toast.error(data.error);
            return;
        }

        await utils.sampledValuesSettings.getSampledValuesSettings.invalidate();
        router.refresh();
        toast.success(`Sampled Values Setting ${action}d!`);
    };

    const onError = async (
        action: "create" | "update" | "delete",
        data?: { error?: string }
    ) => {};

    const { mutate: createSampledValuesSetting, isLoading: isCreating } =
        trpc.sampledValuesSettings.createSampledValuesSetting.useMutation({
            onSuccess: (res) => onSuccess("create"),
            onError: (err) => onError("create", { error: err.message }),
        });

    const { mutate: updateSampledValuesSetting, isLoading: isUpdating } =
        trpc.sampledValuesSettings.updateSampledValuesSetting.useMutation({
            onSuccess: (res) => onSuccess("update"),
            onError: (err) => onError("update", { error: err.message }),
        });

    const { mutate: deleteSampledValuesSetting, isLoading: isDeleting } =
        trpc.sampledValuesSettings.deleteSampledValuesSetting.useMutation({
            onSuccess: (res) => onSuccess("delete"),
            onError: (err) => onError("delete", { error: err.message }),
        });

    const handleSubmit = (values: NewSampledValuesSettingParams) => {
        if (editing) {
            updateSampledValuesSetting({
                ...values,
                id: sampledValuesSettings.id,
            });
        } else {
            createSampledValuesSetting(values);
        }
    };
    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="flex flex-col gap-3 w-1/4"
            >
                <FormField
                    control={form.control}
                    name="appId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>App Id</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>

                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="ethernetInterface"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Network Interface</FormLabel>
                            <FormControl>
                                <Controller
                                    name="ethernetInterface"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Ethernet Interface" />
                                            </SelectTrigger>
                                            <SelectContent className="overflow-visible">
                                                {networkInterfaces?.map(
                                                    (networkInterface) => (
                                                        <SelectItem
                                                            key={
                                                                networkInterface.name
                                                            }
                                                            value={
                                                                networkInterface.name
                                                            }
                                                        >
                                                            <NetworkInterfaceCard
                                                                networkInterface={
                                                                    networkInterface
                                                                }
                                                            />
                                                        </SelectItem>
                                                    )
                                                )}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="dstAddressCheck"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Dst Address Check</FormLabel>
                            <br />
                            <FormControl>
                                <Checkbox
                                    {...field}
                                    checked={!!field.value}
                                    onCheckedChange={field.onChange}
                                    value={""}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="threshold"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Threshold</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>

                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button
                    type="submit"
                    className="mr-1"
                    disabled={isCreating || isUpdating}
                >
                    {`Sav${isUpdating ? "ing..." : "e"}`}
                </Button>
            </form>
        </Form>
    );
}
