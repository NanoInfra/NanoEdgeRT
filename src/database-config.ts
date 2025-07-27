import { db } from "../database/sqlite3.ts";
import { Config, ServiceConfig, ServicePermissions } from "./types.ts";
import { Kysely } from "kysely";
import type { ConfigTable, ServiceTable, PortTable } from "../database/sqlite3.ts";

interface Database {
  services: ServiceTable;
  config: ConfigTable;
  ports: PortTable;
}

export class DatabaseConfig {
  private static instance: DatabaseConfig;
  private config: Config | null = null;
  private dbInstance: Kysely<Database>;

  constructor(dbInstance?: Kysely<Database>) {
    this.dbInstance = dbInstance || db;
  }

  static getInstance(dbInstance?: Kysely<Database>): DatabaseConfig {
    if (!DatabaseConfig.instance) {
      DatabaseConfig.instance = new DatabaseConfig(dbInstance);
    }
    return DatabaseConfig.instance;
  }

  // Create a new instance with custom database (for testing)
  static createInstance(dbInstance: Kysely<Database>): DatabaseConfig {
    return new DatabaseConfig(dbInstance);
  }

  getDbInstance(): Kysely<Database> {
    return this.dbInstance;
  }

  async loadConfig(): Promise<Config> {
    if (this.config) {
      return this.config;
    }

    // Load configuration from database
    const configRows = await this.dbInstance
      .selectFrom("config")
      .selectAll()
      .execute();

    const configMap = new Map(configRows.map((row) => [row.key, row.value]));

    // Load services from database
    const serviceRows = await this.dbInstance
      .selectFrom("services")
      .selectAll()
      .where("enabled", "=", true)
      .execute();

    const services: ServiceConfig[] = serviceRows.map((row) => ({
      name: row.name,
      enable: Boolean(row.enabled),
      jwt_check: Boolean(row.jwt_check),
      permissions: JSON.parse(row.permissions) as ServicePermissions,
      code: row.code,
    }));

    this.config = {
      available_port_start: parseInt(configMap.get("available_port_start") as string || "8001"),
      available_port_end: parseInt(configMap.get("available_port_end") as string || "8999"),
      main_port: parseInt(configMap.get("main_port") as string || "8000"),
      jwt_secret: configMap.get("jwt_secret") as string || "default-secret-change-me",
      services,
    };

    return this.config;
  }

  async updateConfig(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();

    await this.dbInstance
      .insertInto("config")
      .values({
        key,
        value,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value, updated_at: now }))
      .execute();

    // Invalidate cache
    this.config = null;
  }

  async createService(service: {
    name: string;
    code: string;
    enabled?: boolean;
    jwt_check?: boolean;
    permissions?: ServicePermissions;
  }): Promise<void> {
    const now = new Date().toISOString();

    await this.dbInstance
      .insertInto("services")
      .values({
        name: service.name,
        code: service.code,
        enabled: service.enabled ?? true,
        jwt_check: service.jwt_check ?? false,
        permissions: JSON.stringify(
          service.permissions || {
            read: [],
            write: [],
            env: [],
            run: [],
          },
        ),
        created_at: now,
        updated_at: now,
      })
      .execute();

    // Invalidate cache
    this.config = null;
  }

  async updateService(name: string, updates: {
    code?: string;
    enabled?: boolean;
    jwt_check?: boolean;
    permissions?: ServicePermissions;
  }): Promise<void> {
    const updateData: Partial<{
      code: string;
      enabled: boolean;
      jwt_check: boolean;
      permissions: string;
      updated_at: string;
    }> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.code !== undefined) updateData.code = updates.code;
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
    if (updates.jwt_check !== undefined) updateData.jwt_check = updates.jwt_check;
    if (updates.permissions !== undefined) {
      updateData.permissions = JSON.stringify(updates.permissions);
    }

    await this.dbInstance
      .updateTable("services")
      .set(updateData)
      .where("name", "=", name)
      .execute();

    // Invalidate cache
    this.config = null;
  }

  async deleteService(name: string): Promise<void> {
    await this.dbInstance
      .deleteFrom("services")
      .where("name", "=", name)
      .execute();

    // Invalidate cache
    this.config = null;
  }

  async getAllServices(): Promise<
    Array<{
      id?: number;
      name: string;
      code: string;
      enabled: boolean;
      jwt_check: boolean;
      permissions: ServicePermissions;
      created_at?: string;
      updated_at?: string;
    }>
  > {
    const services = await this.dbInstance
      .selectFrom("services")
      .selectAll()
      .execute();

    return services.map((service) => ({
      ...service,
      enabled: Boolean(service.enabled),
      jwt_check: Boolean(service.jwt_check),
      permissions: JSON.parse(service.permissions) as ServicePermissions,
    }));
  }

  async getService(name: string): Promise<
    {
      id?: number;
      name: string;
      code: string;
      enabled: boolean;
      jwt_check: boolean;
      permissions: ServicePermissions;
      created_at?: string;
      updated_at?: string;
    } | null
  > {
    const service = await this.dbInstance
      .selectFrom("services")
      .selectAll()
      .where("name", "=", name)
      .executeTakeFirst();

    if (!service) return null;

    return {
      ...service,
      enabled: Boolean(service.enabled),
      jwt_check: Boolean(service.jwt_check),
      permissions: JSON.parse(service.permissions) as ServicePermissions,
    };
  }

  invalidateCache(): void {
    this.config = null;
  }
}

export const databaseConfig = DatabaseConfig.getInstance();
