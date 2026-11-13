import { randomBytes, randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { migrate } from "../src/database/migrate.js";
import { freshTestKysely } from "../src/database/connection.js";
import type { DB } from "../src/database/types.js";

export interface TestContext {
  db: Kysely<DB>;
}

/** Fresh, fully migrated in-memory database for one test. */
export async function createTestContext(): Promise<TestContext> {
  const db = await freshTestKysely();
  await migrate(db as unknown as Kysely<unknown>);
  return { db };
}

export async function destroyTestContext(ctx: TestContext): Promise<void> {
  await ctx.db.destroy();
}

/** Deterministic fixture ids for the seeded defaults. */
export const TEST_USERS = {
  amara: "00000000-0000-4000-8000-000000000002",
  rhea: "00000000-0000-4000-8000-000000000001",
  naomi: "00000000-0000-4000-8000-000000000003",
} as const;

export function randomEmail(): string {
  return `test-${randomBytes(4).toString("hex")}@workora.example`;
}

export function randomPassword(): string {
  return `pw-${randomBytes(16).toString("base64url")}`;
}
