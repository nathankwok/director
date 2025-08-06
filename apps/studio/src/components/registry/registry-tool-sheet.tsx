"use client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/ui/empty-state";
import { JSONSchema, type JsonSchema } from "@/components/ui/json-schema";
import { Markdown } from "@/components/ui/markdown";
import {
  Section,
  SectionHeader,
  SectionSeparator,
  SectionTitle,
} from "@/components/ui/section";
import {
  Sheet,
  SheetActions,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useRegistryQuery } from "@/hooks/use-registry-query";
import { RegistryGetEntryTool } from "@/trpc/types";

import Link from "next/link";

interface RegistryToolSheetProps {
  tool: RegistryGetEntryTool;
  mcpName: string;
  mcpId: string;
}

export function RegistryToolSheet({
  tool,
  mcpName,
  mcpId,
}: RegistryToolSheetProps) {
  const { serverId, setRegistryQuery } = useRegistryQuery();

  return (
    <Sheet
      open={!!tool}
      onOpenChange={() => setRegistryQuery({ toolId: null, serverId })}
    >
      <SheetContent>
        <SheetActions>
          <Breadcrumb className="grow">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/library`}>Library</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/library/mcp/${mcpId}`}>{mcpName}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{tool.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </SheetActions>

        <SheetBody>
          <SheetHeader>
            <SheetTitle>{tool.name}</SheetTitle>
            <SheetDescription className="text-sm">
              From{" "}
              <Link href={`/library/mcp/${mcpId}`} className="text-fg">
                {mcpName}
              </Link>
            </SheetDescription>
          </SheetHeader>

          <Markdown>{tool.description}</Markdown>

          <SectionSeparator />

          <Section>
            <SectionHeader>
              <SectionTitle variant="h2" asChild>
                <h3>Input schema</h3>
              </SectionTitle>
            </SectionHeader>
            {tool.inputSchema ? (
              <JSONSchema schema={tool.inputSchema as JsonSchema} />
            ) : (
              <EmptyState>
                <EmptyStateTitle>No input schema</EmptyStateTitle>
                <EmptyStateDescription>
                  This tool does not require any parameters.
                </EmptyStateDescription>
              </EmptyState>
            )}
          </Section>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
