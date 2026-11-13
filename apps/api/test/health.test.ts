import assert from "node:assert/strict";
import { after, test } from "node:test";

// NOTE: NODE_ENV and DATABASE_URL must be set before any app module is
// imported, because src/config/env.ts parses the environment at import time.
// The CI workflow (and local invocation) must set:
//   NODE_ENV=test DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/<test-db>
//
// Why not PGlite: Better Auth's kysely adapter introspects pg_catalog /
// information_schema, which PGlite does not implement fully, so the app can
// never boot correctly on PGlite. Local Postgres (and CI's service container)
// match production. Without a real Postgres URL the test skips itself
// rather than pretending to pass.

import { env } from "../src/config/env.js";

const usingPglite = env.DATABASE_URL.startsWith("pglite://");
const skipReason = usingPglite
  ? "DATABASE_URL points at PGlite; Better Auth kysely adapter cannot introspect embedded PGlite — run against real Postgres instead"
  : undefined;

test(
  "GET /healthz reports database up on a migrated database",
  { skip: skipReason },
  async () => {
    const { migrate } = await import("../src/database/migrate.js");
    const { closeDb } = await import("../src/database/connection.js");
    const { buildApp } = await import("../src/app.js");

    await migrate();

    const app = await buildApp({ logger: false });
    after(async () => {
      await app.close();
      await closeDb();
    });

    const res = await app.inject({ method: "GET", url: "/healthz" });
    assert.equal(res.statusCode, 200);
    const body = res.json<{ success: boolean; data: { status: string; db: string } }>();
    assert.equal(body.success, true);
    assert.equal(body.data.status, "ok");
    assert.equal(body.data.db, "up");
  },
);
