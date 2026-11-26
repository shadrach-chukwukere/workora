"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Mirror of the backend's advisory event union. */
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

type EventType = RealtimeEvent["type"];
type Handler = (event: RealtimeEvent) => void;

interface RealtimeContextValue {
  subscribe: (handler: Handler) => () => void;
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);
const LISTENED_TYPES: EventType[] = ["ready", "notification", "message.created"];

/**
 * Opens a single authenticated SSE connection to /api/v1/events for the
 * lifetime of the dashboard shell. Events are advisory — consumers refetch
 * from the REST API, so a reconnect or a missed event can never desync the UI.
 */
export function RealtimeProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const handlers = useRef(new Set<Handler>());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    const source = new EventSource("/api/v1/events");

    const onEvent = (e: Event) => {
      try {
        const event = JSON.parse((e as MessageEvent<string>).data) as RealtimeEvent;
        if (!event || typeof event.type !== "string") return;
        for (const handler of handlers.current) handler(event);
      } catch {
        // Ignore malformed frames; the next event will still be processed.
      }
    };

    for (const type of LISTENED_TYPES) source.addEventListener(type, onEvent);
    source.addEventListener("open", () => setConnected(true));
    source.addEventListener("error", () => setConnected(false));
    // EventSource reconnects automatically using the `retry` value from the server.

    return () => {
      for (const type of LISTENED_TYPES) source.removeEventListener(type, onEvent);
      source.close();
      setConnected(false);
    };
  }, [enabled]);

  const subscribe = useCallback((handler: Handler) => {
    handlers.current.add(handler);
    return () => {
      handlers.current.delete(handler);
    };
  }, []);

  const value = useMemo(() => ({ subscribe, connected }), [subscribe, connected]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

type EventOf<T extends EventType> = Extract<RealtimeEvent, { type: T }>;

/** Subscribe to one event type. The handler always sees the latest render's closure. */
export function useRealtimeEvent<T extends EventType>(
  type: T,
  handler: (event: EventOf<T>) => void,
): void {
  const context = useContext(RealtimeContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!context) return;
    return context.subscribe((event) => {
      if (event.type === type) handlerRef.current(event as EventOf<T>);
    });
  }, [context, type]);
}

export function useRealtimeStatus(): boolean {
  return useContext(RealtimeContext)?.connected ?? false;
}
