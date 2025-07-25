import { AppError, ErrorCode } from "@director.run/utilities/error";
import { getLogger } from "@director.run/utilities/logger";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { AbstractClient, type SerializedClient } from "./abstract-client";

const logger = getLogger("client/stdio");

export class StdioClient extends AbstractClient {
  public readonly command: string;
  public readonly args: string[];
  public readonly env?: Record<string, string>;

  constructor(params: {
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
  }) {
    super(params.name);
    this.command = params.command;
    this.args = params.args;
    this.env = params.env;
  }

  public async connectToTarget({ throwOnError }: { throwOnError: boolean }) {
    try {
      await this.connect(
        new StdioClientTransport({
          command: this.command,
          args: this.args,
          env: this.env,
        }),
      );
      this.status = "connected";
      this.lastConnectedAt = new Date();
      return true;
    } catch (e) {
      const { appError, lastErrorMessage, status } = transportErrorToAppError(
        e,
        this.name,
        this.command,
        this.args,
        this.env,
      );
      this.status = status;
      this.lastErrorMessage = lastErrorMessage;
      if (throwOnError) {
        throw appError;
      } else {
        return false;
      }
    }
  }

  public static async createAndConnectToStdio(
    command: string,
    args: string[],
    env?: Record<string, string>,
  ) {
    const client = new StdioClient({
      name: "test client",
      command,
      args,
      env,
    });
    await client.connectToTarget({ throwOnError: true });
    return client;
  }

  public toPlainObject(): SerializedClient {
    return {
      name: this.name,
      status: this.status,
      lastConnectedAt: this.lastConnectedAt,
      lastErrorMessage: this.lastErrorMessage,
      command: [this.command, ...(this.args ?? [])].join(" "),
      type: "stdio",
    };
  }
}

function transportErrorToAppError(
  error: unknown,
  serverName: string,
  command: string,
  args: string[],
  env?: Record<string, string>,
): {
  appError: AppError;
  lastErrorMessage: string;
  status: "connected" | "unauthorized" | "error";
} {
  let status: "connected" | "unauthorized" | "error";
  let lastErrorMessage: string;
  let appError: AppError;

  if (error instanceof Error && (error as ErrnoException).code === "ENOENT") {
    appError = new AppError(
      ErrorCode.CONNECTION_REFUSED,
      `[${serverName}] command not found: '${command}'. Please make sure it is installed and available in your $PATH.`,
      {
        targetName: serverName,
        command: command,
        args: args,
        env: env,
      },
    );
    lastErrorMessage = appError.message;
    status = "error";
  } else if (error instanceof McpError) {
    appError = new AppError(
      ErrorCode.CONNECTION_REFUSED,
      `[${serverName}] failed to run '${[command, ...args].join(" ")}'. Please check the logs for more details.`,
      {
        targetName: serverName,
        command: command,
        args: args,
        env,
      },
    );
    lastErrorMessage = appError.message;
    status = "error";
  } else {
    status = "error";
    lastErrorMessage = error instanceof Error ? error.message : "unknown error";
    appError = new AppError(
      ErrorCode.CONNECTION_REFUSED,
      `connection refused, [${serverName}] failed to connect`,
      { targetName: serverName, command, args, env },
    );
  }

  return { appError, lastErrorMessage, status };
}
