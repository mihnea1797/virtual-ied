"use client";

import { GooseSetting, NewGooseSettingParams, insertGooseSettingParams } from "@/lib/db/schema/gooseSettings";
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

const GooseSettingForm = ({
  gooseSetting,
  closeModal,
}: {
  gooseSetting?: GooseSetting;
  closeModal?: () => void;
}) => {
  
  const editing = !!gooseSetting?.id;

  const router = useRouter();
  const utils = trpc.useUtils();

  const form = useForm<z.infer<typeof insertGooseSettingParams>>({
    // latest Zod release has introduced a TS error with zodResolver
    // open issue: https://github.com/colinhacks/zod/issues/2663
    // errors locally but not in production
    resolver: zodResolver(insertGooseSettingParams),
    defaultValues: gooseSetting ?? {
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
     ndsCom: false
    },
  });

  const onSuccess = async (action: "create" | "update" | "delete",
    data?: { error?: string },
  ) => {
        if (data?.error) {
      toast.error(data.error)
      return;
    }

    await utils.gooseSettings.getGooseSettings.invalidate();
    router.refresh();
    if (closeModal) closeModal();
        toast.success(`Goose Setting ${action}d!`);
  };

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

  const { mutate: deleteGooseSetting, isLoading: isDeleting } =
    trpc.gooseSettings.deleteGooseSetting.useMutation({
      onSuccess: (res) => onSuccess("delete"),
      onError: (err) => onError("delete", { error: err.message }),
    });

  const handleSubmit = (values: NewGooseSettingParams) => {
    if (editing) {
      updateGooseSetting({ ...values, id: gooseSetting.id });
    } else {
      createGooseSetting(values);
    }
  };
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className={"h-96 overflow-auto"}>
        <FormField
          control={form.control}
          name="vlanPriority"
          render={({ field }) => (<FormItem>
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
          render={({ field }) => (<FormItem>
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
          name="dstAddress"
          render={({ field }) => (<FormItem>
              <FormLabel>Dst Address</FormLabel>
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
          name="useVlanTag"
          render={({ field }) => (<FormItem>
              <FormLabel>Use Vlan Tag</FormLabel>
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
          name="goId"
          render={({ field }) => (<FormItem>
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
          render={({ field }) => (<FormItem>
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
          render={({ field }) => (<FormItem>
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
          render={({ field }) => (<FormItem>
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
          render={({ field }) => (<FormItem>
              <FormLabel>Simulation</FormLabel>
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
          name="confRev"
          render={({ field }) => (<FormItem>
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
          render={({ field }) => (<FormItem>
              <FormLabel>Nds Com</FormLabel>
                <br />
            <FormControl>
              <Checkbox {...field} checked={!!field.value} onCheckedChange={field.onChange} value={""} />
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
            onClick={() => deleteGooseSetting({ id: gooseSetting.id })}
          >
            Delet{isDeleting ? "ing..." : "e"}
          </Button>
        ) : null}
      </form>
    </Form>
  );
};

export default GooseSettingForm;
