import path from "node:path";
import fs from "node:fs";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { env } from "../config/env.js";
import { createPGliteDialect } from "./pglite-dialect.js";
import type { DB } from "./types.js";

// int8 (20) comes back from the pg driver as a string; parse to number (our amounts are far below 2^53).
pg.types.setTypeParser(20, (value: string) => Number(value));

async function createKysely(): Promise<Kysely<DB>> {
  const url = env.DATABASE_URL;
  if (url.startsWith("pglite://")) {
    if (env.NODE_ENV === "test") {
      return new Kysely<DB>({ dialect: await createPGliteDialect("memory://") });
    }
    const dataDir = path.resolve(process.cwd(), env.DATABASE_PGLITE_PATH);
    fs.mkdirSync(dataDir, { recursive: true });
    return new Kysely<DB>({ dialect: await createPGliteDialect(dataDir) });
  }
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: url, max: 20 }),
    }),
  });
}

let instance: Kysely<DB> | undefined;
let pending: Promise<Kysely<DB>> | undefined;

export function db(): Promise<Kysely<DB>> {
  if (instance) {
    return Promise.resolve(instance);
  }
  if (!pending) {
    pending = createKysely().then((created) => {
      instance = created;
      pending = undefined;
      return created;
    });
  }
  return pending;
}

/** Fresh embedded, in-memory cluster for one test suite. */
export function freshTestKysely(): Promise<Kysely<DB>> {
  return createPGliteDialect("memory://").then((dialect) => new Kysely<DB>({ dialect }));
}

export async function closeDb(): Promise<void> {
  const current = instance;
  instance = undefined;
  if (current) {
    await current.destroy();
  }
}

export type { DB };
