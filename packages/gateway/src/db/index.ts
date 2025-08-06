import { existsSync } from "node:fs";
import { readJSONFile, writeJSONFile } from "@director.run/utilities/json";
import {
  type DatabaseAttributes,
  type PromptAttributes,
  type ProxyServerAttributes,
  type ProxyTargetAttributes,
  databaseAttributesSchema,
} from "@director.run/utilities/schema";
import slugify from "slugify";

async function readDB(filePath: string): Promise<DatabaseAttributes> {
  const store = await readJSONFile(filePath);
  return databaseAttributesSchema.parse(store);
}

async function writeDB(
  filePath: string,
  data: DatabaseAttributes,
): Promise<void> {
  return await writeJSONFile(filePath, data);
}

export class Database {
  public readonly filePath: string;

  private constructor(filePath: string) {
    this.filePath = filePath;
  }

  static async connect(filePath: string): Promise<Database> {
    const db = new Database(filePath);

    if (!existsSync(filePath)) {
      await writeDB(filePath, {
        version: "1.0.0",
        proxies: [],
      });
    }

    return db;
  }

  async addProxy(
    proxy: Omit<ProxyServerAttributes, "id">,
  ): Promise<ProxyServerAttributes> {
    const store = await readDB(this.filePath);

    const existingProxy = store.proxies.find((p) => p.name === proxy.name);
    if (existingProxy) {
      throw new Error("Proxy already exists");
    }

    const newProxy = {
      ...proxy,
      servers: (proxy.servers || []).map((s) => ({
        ...s,
        name: slugify(s.name, { lower: true, strict: true, trim: true }),
      })),
      id: slugify(proxy.name, { lower: true, strict: true, trim: true }),
    };

    store.proxies.push(newProxy);
    await writeDB(this.filePath, store);

    return newProxy;
  }

  async getProxy(id: string): Promise<ProxyServerAttributes> {
    const store = await readDB(this.filePath);
    const proxy = store.proxies.find((p) => p.id === id);

    if (!proxy) {
      throw new Error("Proxy not found");
    }

    return proxy;
  }

  async deleteProxy(id: string): Promise<void> {
    const store = await readDB(this.filePath);
    const proxy = store.proxies.find((p) => p.id === id);

    if (!proxy) {
      throw new Error("Proxy not found");
    }

    store.proxies = store.proxies.filter((p) => p.id !== id);
    await writeDB(this.filePath, store);
  }

  async updateProxy(
    id: string,
    attributes: Partial<ProxyServerAttributes>,
  ): Promise<ProxyServerAttributes> {
    const store = await readDB(this.filePath);
    const proxy = store.proxies.find((p) => p.id === id);

    if (!proxy) {
      throw new Error("Proxy not found");
    }

    Object.assign(proxy, {
      ...attributes,
      name: attributes.name ?? proxy.name, // don't allow name to be set to undefined
      servers: (attributes.servers || proxy.servers || []).map((s) => ({
        ...s,
        name: slugify(s.name, { lower: true, trim: true }),
      })),
    });

    await writeDB(this.filePath, store);

    return proxy;
  }

  async countProxies(): Promise<number> {
    const store = await readDB(this.filePath);
    return store.proxies.length;
  }

  async updateServer(
    proxyId: string,
    serverName: string,
    attributes: Partial<ProxyTargetAttributes>,
  ): Promise<ProxyTargetAttributes> {
    const store = await readDB(this.filePath);
    const proxy = store.proxies.find((p) => p.id === proxyId);

    if (!proxy) {
      throw new Error("Proxy not found");
    }

    const server = proxy.servers.find((s) => s.name === serverName);
    if (!server) {
      throw new Error("Server not found");
    }

    Object.assign(server, attributes);

    await writeDB(this.filePath, store);

    return server;
  }

  async getServer(
    proxyId: string,
    serverName: string,
  ): Promise<ProxyTargetAttributes> {
    const store = await readDB(this.filePath);
    const proxy = store.proxies.find((p) => p.id === proxyId);

    if (!proxy) {
      throw new Error("Proxy not found");
    }

    const server = proxy.servers.find((s) => s.name === serverName);
    if (!server) {
      throw new Error("Server not found");
    }

    return server;
  }

  async addServer(
    proxyId: string,
    server: ProxyTargetAttributes,
  ): Promise<ProxyTargetAttributes> {
    const proxyDbEntry = await this.getProxy(proxyId);
    await this.updateProxy(proxyId, {
      servers: [...proxyDbEntry.servers, server],
    });
    return server;
  }

  async removeServer(proxyId: string, serverName: string): Promise<boolean> {
    const proxyDbEntry = await this.getProxy(proxyId);
    await this.updateProxy(proxyId, {
      servers: proxyDbEntry.servers.filter(
        (s) => s.name.toLocaleLowerCase() !== serverName.toLocaleLowerCase(),
      ),
    });

    return true;
  }

  async getAll(): Promise<ProxyServerAttributes[]> {
    const store = await readDB(this.filePath);
    return store.proxies;
  }

  async purge(): Promise<void> {
    await writeDB(this.filePath, {
      version: "1.0.0",
      proxies: [],
    });
  }

  async addPrompt(proxyId: string, prompt: PromptAttributes) {
    const proxy = await this.getProxy(proxyId);
    await this.updateProxy(proxyId, {
      prompts: [...(proxy.prompts || []), prompt],
    });
    return prompt;
  }

  async getPrompts(proxyId: string): Promise<PromptAttributes[]> {
    const proxy = await this.getProxy(proxyId);
    return proxy.prompts || [];
  }

  async removePrompt(proxyId: string, promptName: string): Promise<boolean> {
    const proxy = await this.getProxy(proxyId);
    const updatedPrompts = (proxy.prompts || []).filter(
      (p) => p.name !== promptName,
    );

    if (updatedPrompts.length === (proxy.prompts || []).length) {
      throw new Error(`Prompt ${promptName} not found`);
    }

    await this.updateProxy(proxyId, {
      prompts: updatedPrompts,
    });
    return true;
  }

  async updatePrompt(
    proxyId: string,
    promptName: string,
    prompt: Partial<PromptAttributes>,
  ): Promise<PromptAttributes> {
    const proxy = await this.getProxy(proxyId);
    const promptIndex = (proxy.prompts || []).findIndex(
      (p) => p.name === promptName,
    );

    if (promptIndex === -1) {
      throw new Error(`Prompt ${promptName} not found`);
    }

    const currentPrompt = proxy.prompts?.[promptIndex];
    if (!currentPrompt) {
      throw new Error(`Prompt ${promptName} not found`);
    }

    const updatedPrompt: PromptAttributes = {
      ...currentPrompt,
      ...(prompt.title && { title: prompt.title }),
      ...(prompt.description !== undefined && {
        description: prompt.description,
      }),
      ...(prompt.body && { body: prompt.body }),
    };

    const updatedPrompts = [...(proxy.prompts || [])];
    updatedPrompts[promptIndex] = updatedPrompt;

    await this.updateProxy(proxyId, {
      prompts: updatedPrompts,
    });

    return updatedPrompt;
  }
}
