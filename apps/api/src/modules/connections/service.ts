import type { Kysely } from "kysely";
import type { DB } from "../../database/types.js";
import { badRequest, notFound } from "../../plugins/error-handler.js";
import type { AuthedUser } from "../common/index.js";
import * as repo from "./repository.js";

type Db = Kysely<DB>;

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

function assertUuid(id: string): void {
  if (!UUID_RE.test(id)) throw badRequest("Invalid user id");
}

async function ensureConnectable(db: Db, userId: string): Promise<void> {
  assertUuid(userId);
  const user = await repo.findConnectableUser(db, userId);
  if (!user || user.status !== "active" || !["freelancer", "client"].includes(user.account_type)) {
    throw notFound("User not found");
  }
}

export async function getStatus(db: Db, viewerId: string | null, targetId: string) {
  await ensureConnectable(db, targetId);
  const [counts, connected] = await Promise.all([
    repo.getConnectionCounts(db, targetId),
    viewerId && viewerId !== targetId ? repo.isConnected(db, viewerId, targetId) : Promise.resolve(false),
  ]);
  return {
    connected,
    isSelf: viewerId === targetId,
    ...counts,
  };
}

export async function connect(db: Db, viewer: AuthedUser, targetId: string) {
  if (viewer.id === targetId) throw badRequest("You cannot connect with yourself");
  await ensureConnectable(db, targetId);
  await repo.addConnection(db, viewer.id, targetId);
  return { connected: true, isSelf: false, ...(await repo.getConnectionCounts(db, targetId)) };
}

export async function disconnect(db: Db, viewer: AuthedUser, targetId: string) {
  if (viewer.id === targetId) throw badRequest("You cannot connect with yourself");
  await ensureConnectable(db, targetId);
  await repo.removeConnection(db, viewer.id, targetId);
  return { connected: false, isSelf: false, ...(await repo.getConnectionCounts(db, targetId)) };
}

export async function listMyConnections(
  db: Db,
  viewer: AuthedUser,
  direction: "followers" | "following",
  limit: number,
  offset: number,
) {
  const result = await repo.listConnections(db, viewer.id, direction, limit, offset);
  return { ...result, page: Math.floor(offset / limit) + 1, perPage: limit };
}
