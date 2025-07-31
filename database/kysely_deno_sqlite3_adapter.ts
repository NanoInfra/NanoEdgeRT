import {
  CompiledQuery,
  DatabaseConnection,
  DatabaseIntrospector,
  Dialect,
  DialectAdapter,
  DialectAdapterBase,
  Driver,
  Kysely,
  QueryCompiler,
  QueryResult,
  SqliteQueryCompiler,
} from "kysely";

import { Database as Sqlite } from "jsr:@db/sqlite";

export class DenoSqliteDialect implements Dialect {
  readonly #config: Sqlite;

  constructor(config: Sqlite) {
    this.#config = config;
  }

  createDriver(): Driver {
    return new SqliteDriver(this.#config);
  }

  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }

  createAdapter(): DialectAdapter {
    return new SqliteAdapter();
  }

  // deno-lint-ignore no-explicit-any
  createIntrospector(_db: Kysely<any>): DatabaseIntrospector {
    throw new Error("SqliteIntrospector is not supported in Deno Kysely adapter");
  }
}

class SqliteAdapter extends DialectAdapterBase {
  override get supportsTransactionalDdl(): boolean {
    return false;
  }

  override get supportsReturning(): boolean {
    return true;
  }

  override async acquireMigrationLock(): Promise<void> {}
  override async releaseMigrationLock(): Promise<void> {}
}

class SqliteDriver implements Driver {
  readonly #db: Sqlite;
  #locked = false;

  constructor(config: Sqlite) {
    this.#db = config;
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    while (this.#locked) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    this.#locked = true;
    return this;
  }

  // deno-lint-ignore require-await
  async beginTransaction(): Promise<void> {
    this.#db.exec("BEGIN");
  }

  // deno-lint-ignore require-await
  async commitTransaction(): Promise<void> {
    this.#db.exec("COMMIT");
  }

  // deno-lint-ignore require-await
  async rollbackTransaction(): Promise<void> {
    this.#db.exec("ROLLBACK");
  }

  // deno-lint-ignore require-await
  async releaseConnection(): Promise<void> {
    this.#locked = false;
  }

  // deno-lint-ignore require-await
  async destroy(): Promise<void> {
    this.#db.close();
  }

  // deno-lint-ignore require-await
  async executeQuery<R>({ sql, parameters }: CompiledQuery): Promise<QueryResult<R>> {
    // deno-lint-ignore no-explicit-any
    const rows = this.#db.prepare(sql).all(...(parameters as any[]));
    const { changes, lastInsertRowId } = this.#db;

    return {
      rows: rows as R[],
      numAffectedRows: BigInt(changes),
      insertId: BigInt(lastInsertRowId),
    };
  }

  async *streamQuery<R>({ sql, parameters }: CompiledQuery): AsyncIterableIterator<QueryResult<R>> {
    // deno-lint-ignore no-explicit-any
    const stmt = this.#db.prepare(sql).bind(parameters as any[]);
    for (const row of stmt) {
      yield {
        rows: [row],
      };
    }
  }
}
