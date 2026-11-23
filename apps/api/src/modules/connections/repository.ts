import { sql, type Kysely } from "kysely";
import type { DB } from "../../database/types.js";

type Db = Kysely<DB>;

export interface ConnectionCountsRow {
  followers_count: number | string;
  following_count: number | string;
}

export interface ConnectionUserRow {
  id: string;
  name: string;
  image: string | null;
  account_type: "freelancer" | "client" | "admin";
  headline: string | null;
  company_name: string | null;
  connected_at: Date | string;
}

export async function getConnectionCounts(db: Db, userId: string) {
  const result = await sql<ConnectionCountsRow>`
    SELECT
      (SELECT count(*)::int FROM connections WHERE following_id = ${userId}) AS followers_count,
      (SELECT count(*)::int FROM connections WHERE follower_id = ${userId}) AS following_count
  `.execute(db);
  const row = result.rows[0];
  return {
    followersCount: Number(row?.followers_count ?? 0),
    followingCount: Number(row?.following_count ?? 0),
  };
}

export async function isConnected(db: Db, followerId: string, followingId: string): Promise<boolean> {
  const row = await db
    .selectFrom("connections")
    .select("follower_id")
    .where("follower_id", "=", followerId)
    .where("following_id", "=", followingId)
    .executeTakeFirst();
  return row !== undefined;
}

export async function findConnectableUser(
  db: Db,
  userId: string,
): Promise<{ id: string; account_type: string; status: string } | null> {
  const result = await sql<{ id: string; account_type: string; status: string }>`
    SELECT id, account_type, status FROM users WHERE id = ${userId}
  `.execute(db);
  return result.rows[0] ?? null;
}

export async function addConnection(db: Db, followerId: string, followingId: string): Promise<void> {
  await db
    .insertInto("connections")
    .values({ follower_id: followerId, following_id: followingId })
    .onConflict((oc) => oc.columns(["follower_id", "following_id"]).doNothing())
    .execute();
}

export async function removeConnection(db: Db, followerId: string, followingId: string): Promise<void> {
  await db
    .deleteFrom("connections")
    .where("follower_id", "=", followerId)
    .where("following_id", "=", followingId)
    .execute();
}

async function listRows(
  db: Db,
  userId: string,
  direction: "followers" | "following",
  limit: number,
  offset: number,
): Promise<ConnectionUserRow[]> {
  const joinColumn = direction === "followers" ? "c.follower_id" : "c.following_id";
  const whereColumn = direction === "followers" ? "c.following_id" : "c.follower_id";
  const result = await sql<ConnectionUserRow>`
    SELECT u.id, u.name, u.image, u.account_type, fp.headline, cp.company_name, c.created_at AS connected_at
    FROM connections c
    JOIN users u ON u.id = ${sql.ref(joinColumn)}
    LEFT JOIN freelancer_profiles fp ON fp.user_id = u.id
    LEFT JOIN client_profiles cp ON cp.user_id = u.id
    WHERE ${sql.ref(whereColumn)} = ${userId} AND u.status = 'active'
    ORDER BY c.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `.execute(db);
  return result.rows;
}

async function countRows(db: Db, userId: string, direction: "followers" | "following"): Promise<number> {
  const whereColumn = direction === "followers" ? "c.following_id" : "c.follower_id";
  const result = await sql<{ total: number | string }>`
    SELECT count(*)::int AS total
    FROM connections c
    JOIN users u ON u.id = ${sql.ref(direction === "followers" ? "c.follower_id" : "c.following_id")}
    WHERE ${sql.ref(whereColumn)} = ${userId} AND u.status = 'active'
  `.execute(db);
  return Number(result.rows[0]?.total ?? 0);
}

export async function listConnections(
  db: Db,
  userId: string,
  direction: "followers" | "following",
  limit: number,
  offset: number,
) {
  const [rows, total] = await Promise.all([
    listRows(db, userId, direction, limit, offset),
    countRows(db, userId, direction),
  ]);
  return {
    total,
    users: rows.map((row) => ({
      id: row.id,
      name: row.name,
      image: row.image,
      account_type: row.account_type,
      headline: row.headline,
      company_name: row.company_name,
      connected_at: new Date(row.connected_at).toISOString(),
    })),
  };
}
