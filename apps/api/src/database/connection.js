import path from "node:path";
import fs from "node:fs";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { env } from "../config/env.js";
import { createPGliteDialect } from "./pglite-dialect.js";
// int8 (20) comes back from the pg driver as a string; parse to number (our amounts are far below 2^53).
pg.types.setTypeParser(20, (value) => Number(value));
async function createKysely() {
    const url = env.DATABASE_URL;
    if (url.startsWith("pglite://")) {
        if (env.NODE_ENV === "test") {
            return new Kysely({ dialect: await createPGliteDialect("memory://") });
        }
        const dataDir = path.resolve(process.cwd(), env.DATABASE_PGLITE_PATH);
        fs.mkdirSync(dataDir, { recursive: true });
        return new Kysely({ dialect: await createPGliteDialect(dataDir) });
    }
    return new Kysely({
        dialect: new PostgresDialect({
            pool: new pg.Pool({ connectionString: url, max: 20 }),
        }),
    });
}
let instance;
let pending;
export function db() {
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
export function freshTestKysely() {
    return createPGliteDialect("memory://").then((dialect) => new Kysely({ dialect }));
}
export async function closeDb() {
    const current = instance;
    instance = undefined;
    if (current) {
        await current.destroy();
    }
}
