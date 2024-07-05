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
    GooseSettings,
    NewGooseSettingParams,
    insertGooseSettingParams,
} from "@/lib/db/schema/gooseSettings";
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

type GooseSettingsFormProps = {
    gooseSettings: GooseSettings | null;
    networkInterfaces: NetworkInterfaces | null;
};

export default function GooseSettingsForm({
    gooseSettings,
    networkInterfaces,
}: GooseSettingsFormProps) {
    const editing = !!gooseSettings?.id;

    const router = useRouter();
    const utils = trpc.useUtils();

    const form = useForm<z.infer<typeof insertGooseSettingParams>>({
        // latest Zod release has introduced a TS error with zodResolver
        // open issue: https://github.com/colinhacks/zod/issues/2663
        // errors locally but not in production
        resolver: zodResolver(insertGooseSettingParams),
        // @ts-ignore
        defaultValues: gooseSettings ?? {
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

        await utils.gooseSettings.getGooseSettings.invalidate();
        router.refresh();
        toast.success(`Goose Setting ${action}d!`);
    };

    const onError = async (
        action: "create" | "update" | "delete",
        data?: { error?: string }
    ) => {};

    const { mutate: createGooseSetting, isLoading: isCreating } =
        trpc.gooseSettings.createGooseSetting.useMutation({
            onSuccess: (res) => onSuccess("create"),
            onError: (err) => onError("create", { error: err.message }),
        });

    const { mutate: updateGooseSetting, isLoading: isUpdating } =
        trpc.gooseSettings.updateGooseSetting.useMutation({
            onSuccess: (res) => onSuccess("update"),
            onError: (err) => onError("update", { error: err.message }),
        });

    const handleSubmit = (values: NewGooseSettingParams) => {
        if (editing) {
            updateGooseSetting({ ...values, id: gooseSettings.id });
        } else {
            createGooseSetting(values);
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
                    name="vlanPriority"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Vlan Priority</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>

                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="vlanId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Vlan Id</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>

                            <FormMessage />
                        </FormItem>
                    )}
                />
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
                    name="dstAddress"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Dst Address</FormLabel>
                            <FormControl>
                                {/* @ts-ignore */}
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
                    name="useVlanTag"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Use Vlan Tag</FormLabel>
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
                    name="goId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Go Id</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>

                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="goCb"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Go Cb</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>

                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="timeAllowedToLive"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Time Allowed To Live</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>

                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="dataSetRef"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Data Set Ref</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>

                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="simulation"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Simulation</FormLabel>
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
                    name="confRev"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Conf Rev</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>

                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="ndsCom"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nds Com</FormLabel>
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
