"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { InputField } from "@/components/ui/form/input-field";
import { SelectNativeField } from "@/components/ui/form/select-native-field";
import { toast } from "@/components/ui/toast";
import { useRegistryQuery } from "@/hooks/use-registry-query";
import { useZodForm } from "@/hooks/use-zod-form";
import { trpc } from "@/trpc/client";
import { RegistryGetEntryByName, StoreGetAll } from "@/trpc/types";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { SimpleMarkdown } from "../ui/markdown";

interface RegistryInstallFormProps {
  mcp: RegistryGetEntryByName;
  proxies: StoreGetAll;
}

export function RegistryInstallForm({
  mcp,
  proxies,
}: RegistryInstallFormProps) {
  const router = useRouter();
  const { serverId } = useRegistryQuery();

  const parameters = (mcp.parameters ?? []).filter(
    (parameter, index, array) =>
      array.findIndex((p) => p.name === parameter.name) === index,
  );

  const utils = trpc.useUtils();

  const transportMutation = trpc.registry.getTransportForEntry.useMutation();

  const installMutation = trpc.store.addServer.useMutation({
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
      });
    },
    onSuccess: (data, variables) => {
      utils.store.get.invalidate({ proxyId: variables.proxyId });
      utils.store.getAll.invalidate();
      toast({
        title: "Proxy installed",
        description: "This proxy was successfully installed.",
      });
      router.push(`/${variables.proxyId}`);
    },
  });

  const schema = z.object({
    proxyId: z.string(),
    parameters: z.object(
      parameters.reduce(
        (acc, param) => {
          acc[param.name] = z.string().trim().min(1, "Required");
          return acc;
        },
        {} as Record<string, z.ZodType<string>>,
      ),
    ),
  });

  const form = useZodForm({
    schema,
    defaultValues: {
      proxyId: serverId ?? proxies[0]?.id ?? "",
      parameters: parameters.reduce(
        (acc, param) => {
          acc[param.name] = "";
          return acc;
        },
        {} as Record<string, string>,
      ),
    },
  });

  return (
    <Form
      form={form}
      className="gap-y-0 overflow-hidden rounded-xl bg-accent-subtle shadow-[0_0_0_0.5px_rgba(55,50,46,0.15)]"
      onSubmit={async (values) => {
        const transport = await transportMutation.mutateAsync({
          entryName: mcp.name,
          parameters: values.parameters,
        });
        installMutation.mutate({
          proxyId: values.proxyId,
          server: {
            name: mcp.name,
            transport,
          },
        });
      }}
    >
      <div className="flex flex-col gap-y-4 p-4">
        <SelectNativeField name="proxyId" label="Select a proxy">
          {proxies.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name}
            </option>
          ))}
        </SelectNativeField>
        {parameters.map((param) => (
          <InputField
            type={param.password ? "password" : "text"}
            key={param.name}
            name={`parameters.${param.name}`}
            label={param.name}
            helperLabel={!param.required ? "Optional" : undefined}
            description={<SimpleMarkdown>{param.description}</SimpleMarkdown>}
            autoCorrect="off"
            spellCheck={false}
          />
        ))}
      </div>

      <div className="border-fg/7 border-t-[0.5px] bg-accent px-4 py-2.5">
        <Button
          type="submit"
          disabled={installMutation.isPending}
          className="w-full"
        >
          {installMutation.isPending ? "Installing..." : "Add to proxy"}
        </Button>
      </div>
    </Form>
  );
}
