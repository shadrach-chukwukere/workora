import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { sql } from "kysely";
import { buildApp } from "../src/app.js";
import { db } from "../src/database/connection.js";
import { executeOperation, getOperation, type Actor } from "../src/modules/agent/operations.js";
import { verifyConfirmation } from "../src/modules/mcp/confirmation.js";

const suffix = randomUUID();
const clientEmail = `agent-client-${suffix}@example.invalid`;
const freelancerEmail = `agent-freelancer-${suffix}@example.invalid`;
let clientId = "";
let freelancerId = "";

function actor(userId: string): Actor {
  return { userId, token: null, session: true };
}

before(async () => {
  const instance = await db();
  const client = await sql<{ id: string }>`
    INSERT INTO users (name, email, account_type, email_verified)
    VALUES ('Agent Client', ${clientEmail}, 'client', true) RETURNING id
  `.execute(instance);
  const freelancer = await sql<{ id: string }>`
    INSERT INTO users (name, email, account_type, email_verified)
    VALUES ('Agent Freelancer', ${freelancerEmail}, 'freelancer', true) RETURNING id
  `.execute(instance);
  clientId = client.rows[0]!.id;
  freelancerId = freelancer.rows[0]!.id;
});

after(async () => {
  const instance = await db();
  await sql`DELETE FROM projects WHERE client_id = ${clientId}`.execute(instance);
  await sql`DELETE FROM users WHERE id IN (${clientId}, ${freelancerId})`.execute(instance);
  await sql`DELETE FROM agent_idempotency WHERE user_id IN (${clientId}, ${freelancerId})`.execute(instance);
});

describe("two-step confirmation", () => {
  it("prepares a proposal without writing and binds the token to exact parameters", async () => {
    const op = getOperation("create_proposal_draft")!;
    const input = {
      projectId: randomUUID(),
      coverLetter: "I can help with this project because I have shipped similar work.",
      bidType: "fixed",
      bidAmountMinor: 150000,
    };
    const preview = (await executeOperation(op, actor(freelancerId), input)) as {
      requiresConfirmation: boolean;
      confirmationToken: string;
    };
    assert.equal(preview.requiresConfirmation, true);
    assert.equal(
      verifyConfirmation(preview.confirmationToken, "create_proposal_draft", freelancerId, input),
      true,
    );
    assert.equal(
      verifyConfirmation(preview.confirmationToken, "create_proposal_draft", freelancerId, { ...input, bidAmountMinor: 1 }),
      false,
    );
    assert.equal(verifyConfirmation(preview.confirmationToken, "create_proposal_draft", clientId, input), false);
  });

  it("rejects a submit with a token for different parameters", async () => {
    const op = getOperation("submit_proposal")!;
    await assert.rejects(
      executeOperation(op, actor(freelancerId), {
        projectId: randomUUID(),
        coverLetter: "A different letter that is definitely long enough to pass validation.",
        bidType: "fixed",
        bidAmountMinor: 150000,
        confirmationToken: "invalid.token",
      }),
      (error: unknown) =>
        typeof error === "object" && error !== null && "code" in error && error.code === "INVALID_CONFIRMATION",
    );
  });
});

describe("idempotency", () => {
  it("returns the same stored result for a repeated create with the same key", async () => {
    const op = getOperation("create_job_draft")!;
    const input = {
      title: "Build a landing page",
      summary: "Short summary",
      description: "A longer description of the work to be done.",
      budgetType: "fixed",
      budgetMinMinor: 100000,
      idempotencyKey: randomUUID(),
    };
    const first = (await executeOperation(op, actor(clientId), input)) as { data: { job: { id: string } } };
    const second = (await executeOperation(op, actor(clientId), input)) as { data: { job: { id: string } } };
    assert.equal(second.data.job.id, first.data.job.id);
  });
});

describe("rate limiting", () => {
  it("throttles repeated MCP requests from the same IP", async () => {
    const app = await buildApp({ logger: false });
    await app.ready();
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    const payload = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "x-forwarded-for": ip,
    };
    let lastStatus = 200;
    for (let i = 0; i < 185; i += 1) {
      const response = await app.inject({ method: "POST", url: "/mcp", headers, payload });
      lastStatus = response.statusCode;
    }
    await app.close();
    assert.equal(lastStatus, 429);
  });
});
