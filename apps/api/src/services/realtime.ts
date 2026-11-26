import type { ServerResponse } from "node:http";

/**
 * Process-local pub/sub for server-sent events.
 *
 * Events are always advisory: every client treats them as "something changed,
 * refetch from the API", so a missed event (or a reconnect) can never leave the
 * UI out of sync. That also makes a multi-instance deployment safe — each
 * instance has its own subscribers, and clients reconnect to whichever
 * instance serves them. A shared broker (Redis pub/sub) can be added later if
 * cross-instance fan-out is needed.
 */

export type RealtimeEvent =
  | { type: "ready"; at: string }
  | {
      type: "notification";
      notificationType: string;
      title: string;
      body: string;
      url: string | null;
      entityType: string | null;
      entityId: string | null;
      at: string;
    }
  | {
      type: "message.created";
      conversationId: string;
      messageId: string;
      senderId: string | null;
      at: string;
    };

interface Subscriber {
  res: ServerResponse;
  heartbeat: NodeJS.Timeout;
}

const MAX_SUBSCRIBERS_PER_USER = 8;
const HEARTBEAT_MS = 25_000;

class RealtimeHub {
  private readonly subscribers = new Map<string, Set<Subscriber>>();

  /** Attach an SSE response to a user's channel. Call after reply.hijack(). */
  subscribe(userId: string, res: ServerResponse): void {
    let channel = this.subscribers.get(userId);
    if (!channel) {
      channel = new Set<Subscriber>();
      this.subscribers.set(userId, channel);
    }

    // Bound per-user connections so a single account cannot exhaust sockets.
    if (channel.size >= MAX_SUBSCRIBERS_PER_USER) {
      const oldest = channel.values().next().value as Subscriber | undefined;
      if (oldest) this.remove(userId, channel, oldest);
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (nginx/Render) so events are flushed immediately.
      "X-Accel-Buffering": "no",
    });
    res.write("retry: 3000\n\n");

    const subscriber: Subscriber = {
      res,
      heartbeat: setInterval(() => {
        // Comment frame keeps intermediaries from closing an idle connection.
        res.write(": ping\n\n");
      }, HEARTBEAT_MS),
    };
    channel.add(subscriber);

    const cleanup = () => {
      clearInterval(subscriber.heartbeat);
      const current = this.subscribers.get(userId);
      if (current) this.remove(userId, current, subscriber);
    };
    res.once("close", cleanup);
    res.once("error", cleanup);
  }

  publish(userId: string, event: RealtimeEvent): void {
    const channel = this.subscribers.get(userId);
    if (!channel || channel.size === 0) return;
    const frame = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const subscriber of [...channel]) {
      try {
        subscriber.res.write(frame);
      } catch {
        clearInterval(subscriber.heartbeat);
        channel.delete(subscriber);
      }
    }
  }

  publishMany(userIds: string[], event: RealtimeEvent): void {
    for (const userId of new Set(userIds)) this.publish(userId, event);
  }

  private remove(userId: string, channel: Set<Subscriber>, subscriber: Subscriber): void {
    clearInterval(subscriber.heartbeat);
    channel.delete(subscriber);
    if (channel.size === 0) this.subscribers.delete(userId);
    if (!subscriber.res.writableEnded) subscriber.res.end();
  }
}

export const realtime = new RealtimeHub();
