"use client";

import { SampledValuesSetting, NewSampledValuesSettingParams, insertSampledValuesSettingParams } from "@/lib/db/schema/sampledValuesSettings";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const SampledValuesSettingForm = ({
  sampledValuesSetting,
  closeModal,
}: {
  sampledValuesSetting?: SampledValuesSetting;
  closeModal?: () => void;
}) => {
  
  const editing = !!sampledValuesSetting?.id;

  const router = useRouter();
  const utils = trpc.useUtils();

  const form = useForm<z.infer<typeof insertSampledValuesSettingParams>>({
    // latest Zod release has introduced a TS error with zodResolver
    // open issue: https://github.com/colinhacks/zod/issues/2663
    // errors locally but not in production
    resolver: zodResolver(insertSampledValuesSettingParams),
    defaultValues: sampledValuesSetting ?? {
      appId: 0,
     ethernetInterface: "",
     dstAddressCheck: false,
     threshold: 0.0
    },
  });

  const onSuccess = async (action: "create" | "update" | "delete",
    data?: { error?: string },
  ) => {
        if (data?.error) {
      toast.error(data.error)
      return;
    }

    await utils.sampledValuesSettings.getSampledValuesSettings.invalidate();
    router.refresh();
    if (closeModal) closeModal();
        toast.success(`Sampled Values Setting ${action}d!`);
  };

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
      updateSampledValuesSetting({ ...values, id: sampledValuesSetting.id });
    } else {
      createSampledValuesSetting(values);
    }
  };
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className={"space-y-8"}>
        <FormField
          control={form.control}
          name="appId"
          render={({ field }) => (<FormItem>
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
          render={({ field }) => (<FormItem>
              <FormLabel>Ethernet Interface</FormLabel>
                <FormControl>
            <Input {...field} />
          </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dstAddressCheck"
          render={({ field }) => (<FormItem>
              <FormLabel>Dst Address Check</FormLabel>
                <br />
            <FormControl>
              <Checkbox {...field} checked={!!field.value} onCheckedChange={field.onChange} value={""} />
            </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="threshold"
          render={({ field }) => (<FormItem>
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
          {editing
            ? `Sav${isUpdating ? "ing..." : "e"}`
            : `Creat${isCreating ? "ing..." : "e"}`}
        </Button>
        {editing ? (
          <Button
            type="button"
            variant={"destructive"}
            onClick={() => deleteSampledValuesSetting({ id: sampledValuesSetting.id })}
          >
            Delet{isDeleting ? "ing..." : "e"}
          </Button>
        ) : null}
      </form>
    </Form>
  );
};

export default SampledValuesSettingForm;
