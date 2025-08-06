import { HTTPClient } from "@director.run/mcp/client/http-client";
import { OAuthHandler } from "@director.run/mcp/oauth/oauth-provider-factory";
import {
  ProxyServer,
  type ProxyTarget,
} from "@director.run/mcp/proxy/proxy-server";
import { AppError, ErrorCode } from "@director.run/utilities/error";
import { getLogger } from "@director.run/utilities/logger";
import type {
  ProxyServerAttributes,
  ProxyTargetAttributes,
} from "@director.run/utilities/schema";
import { Telemetry } from "@director.run/utilities/telemetry";
import {
  PROMPT_MANAGER_TARGET_NAME,
  type Prompt,
  PromptManager,
} from "./capabilities/prompt-manager";
import type { Database } from "./db";

const logger = getLogger("ProxyServerStore");

export class ProxyServerStore {
  private proxyServers: Map<string, ProxyServer> = new Map();
  private db: Database;
  private telemetry: Telemetry;
  private _oAuthHandler?: OAuthHandler;

  private constructor(params: {
    db: Database;
    telemetry?: Telemetry;
    oAuthHandler?: OAuthHandler;
  }) {
    this.db = params.db;
    this.telemetry = params.telemetry || Telemetry.noTelemetry();
    this._oAuthHandler = params.oAuthHandler;
  }

  public static async create({
    db,
    telemetry,
    oAuthHandler,
  }: {
    db: Database;
    telemetry?: Telemetry;
    oAuthHandler?: OAuthHandler;
  }): Promise<ProxyServerStore> {
    logger.debug("initializing ProxyServerStore");
    const store = new ProxyServerStore({
      db,
      telemetry,
      oAuthHandler,
    });
    await store.initialize();
    logger.debug("initialization complete");
    return store;
  }

  private async initialize(): Promise<void> {
    let proxies = await this.db.getAll();

    for (const proxyConfig of proxies) {
      const proxyId = proxyConfig.id;
      logger.debug({ message: `initializing ${proxyId}`, proxyId });

      await this.initializeAndAddProxy({
        id: proxyId,
        name: proxyConfig.name,
        description: proxyConfig.description ?? undefined,
        servers: proxyConfig.servers,
      });
    }
  }

  public get(proxyId: string) {
    const server = this.proxyServers.get(proxyId);
    if (!server) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        `proxy server '${proxyId}' not found or failed to initialize.`,
      );
    }
    return server;
  }

  async delete(proxyId: string) {
    this.telemetry.trackEvent("proxy_deleted");

    const proxy = this.get(proxyId);
    await proxy.close();
    await this.db.deleteProxy(proxyId);
    this.proxyServers.delete(proxyId);
    logger.info(`successfully deleted proxy server configuration: ${proxyId}`);
  }

  async purge() {
    await this.closeAll();
    await this.db.purge();
    this.proxyServers.clear();
  }

  async closeAll() {
    logger.info("cleaning up all proxy servers...");
    await Promise.all(
      Array.from(this.proxyServers.values()).map((proxy) => proxy.close()),
    );
    logger.info("finished cleaning up all proxy servers.");
  }

  public getAll(): ProxyServer[] {
    return Array.from(this.proxyServers.values());
  }

  public async onAuthorizationSuccess(serverUrl: string, code: string) {
    const proxies = this.getAll();
    for (const proxy of proxies) {
      const targets = proxy.targets;
      for (const target of targets) {
        if (target instanceof HTTPClient && target.url === serverUrl) {
          await target.completeAuthFlow(code);
        }
      }
    }
  }

  public async create({
    name,
    description,
    servers,
  }: {
    name: string;
    description?: string;
    servers?: ProxyTargetAttributes[];
  }): Promise<ProxyServer> {
    this.telemetry.trackEvent("proxy_created");

    const configEntry = await this.db.addProxy({
      name,
      description,
      servers: servers ?? [],
    });

    const proxyServer = await this.initializeAndAddProxy({
      name,
      description,
      servers: servers ?? [],
      id: configEntry.id,
    });
    logger.info({ message: `Created new proxy`, proxyId: configEntry.id });
    return proxyServer;
  }

  private async initializeAndAddProxy(proxy: ProxyServerAttributes) {
    const proxyServer = new ProxyServer(
      {
        name: proxy.name,
        id: proxy.id,
        servers: proxy.servers,
        description: proxy.description ?? undefined,
      },
      {
        oAuthHandler: this._oAuthHandler,
      },
    );

    // Add any existing prompts to the proxy server
    const prompts = await this.db.getPrompts(proxy.id);
    await proxyServer.addTarget(new PromptManager(prompts));

    await proxyServer.connectTargets();
    this.proxyServers.set(proxyServer.id, proxyServer);

    return proxyServer;
  }

  public async addServer(
    proxyId: string,
    server: ProxyTargetAttributes,
    params: { throwOnError: boolean } = { throwOnError: true },
  ): Promise<ProxyTarget> {
    this.telemetry.trackEvent("server_added");

    const proxy = this.get(proxyId);
    const target = await proxy.addTarget(server, params);
    await this.db.addServer(proxyId, server);

    return target;
  }

  public async removeServer(
    proxyId: string,
    serverName: string,
  ): Promise<ProxyTarget> {
    this.telemetry.trackEvent("server_removed");

    const proxy = this.get(proxyId);
    const removedTarget = await proxy.removeTarget(serverName);
    await this.db.removeServer(proxyId, serverName);

    return removedTarget;
  }

  public async update(
    proxyId: string,
    attributes: Partial<Pick<ProxyServerAttributes, "name" | "description">>,
  ) {
    this.telemetry.trackEvent("proxy_updated");

    const proxy = this.get(proxyId);
    await proxy.update(attributes);
    await this.db.updateProxy(proxyId, attributes);

    return proxy;
  }

  public async updateServer(
    proxyId: string,
    serverName: string,
    attributes: Partial<
      Pick<ProxyTargetAttributes, "toolPrefix" | "disabledTools">
    >,
  ): Promise<ProxyTarget> {
    const proxy = this.get(proxyId);
    const target = await proxy.updateTarget(serverName, attributes);
    await this.db.updateServer(proxyId, serverName, attributes);

    return target;
  }

  public async addPrompt(proxyId: string, prompt: Prompt) {
    const proxy = this.get(proxyId);
    const promptManager = (await proxy.getTarget(
      PROMPT_MANAGER_TARGET_NAME,
    )) as PromptManager;
    await this.db.addPrompt(proxyId, prompt);
    return await promptManager.addPromptEntry(prompt);
  }

  public async removePrompt(proxyId: string, promptName: string) {
    const proxy = this.get(proxyId);
    const promptManager = (await proxy.getTarget(
      PROMPT_MANAGER_TARGET_NAME,
    )) as PromptManager;
    await this.db.removePrompt(proxyId, promptName);
    await promptManager.removePromptEntry(promptName);
    return true;
  }

  public async updatePrompt(
    proxyId: string,
    promptName: string,
    prompt: Partial<Pick<Prompt, "title" | "description" | "body">>,
  ) {
    const proxy = this.get(proxyId);
    const promptManager = (await proxy.getTarget(
      PROMPT_MANAGER_TARGET_NAME,
    )) as PromptManager;
    await this.db.updatePrompt(proxyId, promptName, prompt);
    return await promptManager.updatePrompt(promptName, prompt);
  }

  public async listPrompts(proxyId: string): Promise<Prompt[]> {
    const proxy = this.get(proxyId);
    const promptManager = (await proxy.getTarget(
      PROMPT_MANAGER_TARGET_NAME,
    )) as PromptManager;
    return promptManager.prompts;
  }
}
