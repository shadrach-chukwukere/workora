import { Migrator } from "kysely/migration";
import { db, closeDb } from "./src/database/connection.js";
import { migrations } from "./src/database/migrate.js";
const provider = { async getMigrations() { return migrations; } };
const instance = await db();
const migrator = new Migrator({ db: instance, provider });
const down = await migrator.migrateDown();
console.log("migrateDown:", down.error ? "ERROR" : "ok", (down.results ?? []).map(r => `${r.migrationName}:${r.status}`));
const downAll = await migrator.migrateTo("0000_none" as any).catch(() => null);
// roll back everything one step at a time
for (let i = 0; i < 6; i++) {
  const r = await migrator.migrateDown();
  console.log("step", i, r.error ? "ERROR: " + String(r.error) : "ok", (r.results ?? []).map(x => `${x.migrationName}:${x.status}`));
  if (r.error) break;
}
const tables = await instance.selectFrom("information_schema.tables" as any).selectAll().execute().catch(() => null);
await closeDb();
