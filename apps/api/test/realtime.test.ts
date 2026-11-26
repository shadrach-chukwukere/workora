import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { ServerResponse } from "node:http";
import Fastify from "fastify";
import { realtime } from "../src/services/realtime.js";
import realtimeRoutes from "../src/modules/realtime/routes.js";

class FakeResponse extends EventEmitter {
  writableEnded = false;
  chunks: string[] = [];
  headers: Record<string, string> | null = null;

  writeHead(_status: number, headers: Record<string, string>) {
    this.headers = headers;
    return this;
  }

  write(chunk: string) {
    this.chunks.push(chunk);
    return true;
  }

  end() {
    if (this.writableEnded) return this;
    this.writableEnded = true;
    this.emit("close");
    return this;
  }
}

test("realtime hub streams events to a subscribed user and stops after close", () => {
  const res = new FakeResponse();
  realtime.subscribe("realtime-test-user", res as unknown as ServerResponse);

  assert.equal(res.headers?.["Content-Type"], "text/event-stream; charset=utf-8");
  assert.match(res.chunks.join(""), /^retry: 3000/);

  realtime.publish("realtime-test-user", {
    type: "notification",
    notificationType: "message",
    title: "New message",
    body: "hello",
    url: "/conversations/1",
    entityType: "message",
    entityId: "m1",
    at: "2026-01-01T00:00:00.000Z",
  });

  const stream = res.chunks.join("");
  assert.match(stream, /event: notification\n/);
  assert.match(stream, /"notificationType":"message"/);

  res.emit("close");
  const afterClose = res.chunks.length;
  realtime.publish("realtime-test-user", { type: "ready", at: "2026-01-01T00:00:00.000Z" });
  assert.equal(res.chunks.length, afterClose, "closed subscribers must not receive events");
});

test("GET /api/v1/events streams events to the authenticated user", async () => {
  const app = Fastify({ logger: false });
  app.addHook("onRequest", async (request) => {
    request.currentUser = {
      id: "sse-test-user",
      accountType: "freelancer",
      verified: true,
      roles: [],
      permissions: new Set<string>(),
    };
  });
  await app.register(realtimeRoutes, { prefix: "/api/v1" });
  await app.listen({ port: 0, host: "127.0.0.1" });

  const address = app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const controller = new AbortController();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/events`, { signal: controller.signal });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const first = await reader.read();
    assert.match(decoder.decode(first.value), /retry: 3000/);

    realtime.publish("sse-test-user", { type: "ready", at: "2026-01-01T00:00:00.000Z" });
    const second = await reader.read();
    assert.match(decoder.decode(second.value), /event: ready/);
    assert.match(decoder.decode(second.value), /"type":"ready"/);

    await reader.cancel();
  } finally {
    controller.abort();
    app.server.closeAllConnections?.();
    await app.close();
  }
});

test("realtime hub does not leak events to other users", () => {
  const first = new FakeResponse();
  const second = new FakeResponse();
  realtime.subscribe("realtime-user-a", first as unknown as ServerResponse);
  realtime.subscribe("realtime-user-b", second as unknown as ServerResponse);

  realtime.publish("realtime-user-a", { type: "ready", at: "2026-01-01T00:00:00.000Z" });

  assert.equal(first.chunks.length > 1, true);
  assert.equal(second.chunks.length, 1); // only the initial retry frame

  first.end();
  second.end();
});
