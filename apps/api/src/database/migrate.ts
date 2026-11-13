import type { Kysely } from "kysely";
import type { Migration, MigrationProvider } from "kysely/migration";
import { Migrator } from "kysely/migration";
import { closeDb, db, freshTestKysely } from "./connection.js";
import * as m0001 from "./migrations/0001_extensions.js";
import * as m0002 from "./migrations/0002_identity.js";
import * as m0003 from "./migrations/0003_profiles_catalog.js";
import * as m0004 from "./migrations/0004_marketplace.js";
import * as m0005 from "./migrations/0005_money.js";
import * as m0006 from "./migrations/0006_communication.js";
import * as m0007 from "./migrations/0007_trust_admin.js";

export const migrations: Record<string, Migration> = {
  "0001_extensions": m0001,
  "0002_identity": m0002,
  "0003_profiles_catalog": m0003,
  "0004_marketplace": m0004,
  "0005_money": m0005,
  "0006_communication": m0006,
  "0007_trust_admin": m0007,
};

const provider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};

async function run(instance: Kysely<unknown>, label: string): Promise<void> {
  const migrator = new Migrator({ db: instance, provider });
  const { error, results } = await migrator.migrateToLatest();
  for (const result of results ?? []) {
    console.log(`${label}: ${result.status}: ${result.migrationName}`);
  }
  if (error) {
    console.error(error);
    process.exit(1);
  }
}

export async function migrate(instance?: Kysely<unknown>): Promise<void> {
  await run(instance ?? ((await db()) as unknown as Kysely<unknown>), "migrate");
}

const isMain = process.argv[1] && import.meta.url.replace(/\\/g, "/").endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain) {
  await migrate();
  await closeDb();
}
