export const makeHTTPTargetConfig = (params: { name: string; url: string; headers?: Record<string, string> }) => ({
  name: params.name,
  transport: {
    type: "http" as const,
    url: params.url,
    headers: params.headers,
  },
});

export const makeStdioTargetConfig = (params: {
  name: string;
  command: string;
  args: string[];
}) => ({
  name: params.name,
  transport: {
    type: "stdio" as const,
    command: params.command,
    args: params.args,
  },
});

export function makeFooBarServerStdioConfig() {
  return makeStdioTargetConfig({
    name: "foo",
    command: "bun",
    args: [
      "-e",
      `
      import { makeFooBarServer } from "@director.run/mcp/test/fixtures";
      import { serveOverStdio } from "@director.run/mcp/transport";
      serveOverStdio(makeFooBarServer());
    `,
    ],
  });
}

