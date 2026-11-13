"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-blocks";
import { cn } from "@/lib/utils";
import { formatDateShort, formatRelative } from "@/lib/format";
import {
  ArrowLeft02Icon,
  CheckmarkCircle02Icon,
  Icon,
  Message01Icon,
  Search01Icon,
  SentIcon,
} from "@/lib/icons";

interface ConversationParticipant {
  id: string;
  name: string;
  image: string | null;
}

interface ConversationLastMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  isDeleted: boolean;
}

interface Conversation {
  id: string;
  kind: string;
  contractId: string | null;
  lastMessage: ConversationLastMessage | null;
  unreadCount: number;
  participants: ConversationParticipant[];
  counterparts: ConversationParticipant[];
  createdAt: string;
}

interface ConversationMessage {
  id: string;
  senderId: string;
  sender?: ConversationParticipant;
  body: string;
  createdAt: string;
  isDeleted: boolean;
}

interface MeResponse {
  user: { id: string };
}

interface ConversationsResponse {
  conversations: Conversation[];
}

interface MessagesResponse {
  messages: ConversationMessage[];
}

async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: init?.body !== undefined ? { "content-type": "application/json", ...init?.headers } : init?.headers,
  });
  if (res.status === 401) {
    const error = new Error("AUTH_REQUIRED");
    error.name = "AuthRequired";
    throw error;
  }
  let envelope: { success?: boolean; message?: string; data?: T } | null = null;
  try {
    envelope = (await res.json()) as { success?: boolean; message?: string; data?: T };
  } catch {
    envelope = null;
  }
  if (!res.ok || !envelope?.success || envelope.data === undefined) {
    throw new Error(envelope?.message ?? `Request to ${path} failed`);
  }
  return envelope.data;
}

function counterpartOf(conversation: Conversation): ConversationParticipant | null {
  return conversation.counterparts[0] ?? null;
}

export default function FreelancerMessagesPage() {
  const router = useRouter();
  const [myId, setMyId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [messagesById, setMessagesById] = useState<Record<string, ConversationMessage[]>>({});
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setError(null);
    try {
      const [me, list] = await Promise.all([
        apiClient<MeResponse>("/api/v1/users/me"),
        apiClient<ConversationsResponse>("/api/v1/conversations"),
      ]);
      setMyId(me.user.id);
      setConversations(list.conversations ?? []);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AuthRequired") {
        router.push("/login");
        return;
      }
      setError(cause instanceof Error ? cause.message : "Could not load conversations");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      setMessagesLoading(true);
      try {
        const data = await apiClient<MessagesResponse>(
          `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages?perPage=50`,
        );
        setMessagesById((prev) => ({ ...prev, [conversationId]: data.messages ?? [] }));
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AuthRequired") {
          router.push("/login");
          return;
        }
        setError(cause instanceof Error ? cause.message : "Could not load messages");
      } finally {
        setMessagesLoading(false);
      }
    },
    [router],
  );

  const filteredThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = counterpartOf(c)?.name.toLowerCase() ?? "";
      return name.includes(q) || (c.lastMessage?.body.toLowerCase().includes(q) ?? false);
    });
  }, [conversations, query]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const activeCounterpart = active ? counterpartOf(active) : null;
  const messages = activeId ? (messagesById[activeId] ?? []) : [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, activeId]);

  async function selectThread(id: string) {
    setActiveId(id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
    if (!messagesById[id]) {
      await loadMessages(id);
    }
    try {
      await apiClient(`/api/v1/conversations/${encodeURIComponent(id)}/read`, { method: "POST" });
    } catch {
      // Non-fatal: the unread badge is already cleared locally.
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    try {
      await apiClient(`/api/v1/conversations/${encodeURIComponent(activeId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setDraft("");
      router.refresh();
      await Promise.all([loadMessages(activeId), loadConversations()]);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AuthRequired") {
        router.push("/login");
        return;
      }
      setError(cause instanceof Error ? cause.message : "Could not send the message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Messages"
        description="Conversations with clients on your active and past work."
        breadcrumbs={[{ label: "Freelancer", href: "/freelancer/dashboard" }, { label: "Messages" }]}
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 flex flex-wrap items-center justify-between gap-3 p-4" role="alert">
          <p className="text-sm text-rose-700">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => { setLoading(true); void loadConversations(); }}>
            Try again
          </Button>
        </div>
      ) : null}

      <div className="grid min-h-[560px] gap-4 lg:h-[calc(100vh-170px)] lg:grid-cols-[minmax(260px,340px)_1fr]">
        {/* Thread list */}
        <aside
          aria-label="Conversations"
          className={cn(
            "rounded-xl border border-neutral-200 bg-white overflow-hidden",
            activeId ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="border-b border-neutral-100 p-3">
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <Icon icon={Search01Icon} size={15} strokeWidth={1.8} />
              </span>
              <Input
                id="thread-search"
                aria-label="Search conversations"
                className="pl-9"
                placeholder="Search people"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-neutral-500">Loading conversations</li>
            ) : null}
            {!loading && conversations.length === 0 && !error ? (
              <li className="px-4 py-10">
                <EmptyState
                  compact
                  icon={<Icon icon={Message01Icon} size={22} strokeWidth={1.8} />}
                  title="No conversations yet"
                  description="When you message a client, or a client messages you, the thread shows up here."
                />
              </li>
            ) : null}
            {filteredThreads.map((conversation) => {
              const counterpart = counterpartOf(conversation);
              const name = counterpart?.name ?? "Unknown participant";
              const unread = conversation.unreadCount;
              const isActive = conversation.id === activeId;
              const preview = conversation.lastMessage
                ? conversation.lastMessage.isDeleted
                  ? "This message was deleted"
                  : conversation.lastMessage.body
                : "No messages yet";
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => void selectThread(conversation.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
                      isActive ? "bg-brand-100" : "hover:bg-neutral-50",
                    )}
                  >
                    <Avatar src={counterpart?.image ?? null} name={name} size="sm" alt="" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-neutral-900">{name}</span>
                        <span className="shrink-0 text-[11px] text-neutral-400">
                          {formatRelative(conversation.lastMessage?.createdAt ?? conversation.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-xs",
                            unread > 0 ? "font-medium text-neutral-700" : "text-neutral-500",
                          )}
                        >
                          {preview}
                        </span>
                        {unread > 0 ? (
                          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">
                            {unread}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!loading && conversations.length > 0 && filteredThreads.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-neutral-500">No conversations match that search.</li>
            ) : null}
          </ul>
        </aside>

        {/* Conversation pane */}
        <section
          aria-label="Conversation"
          className={cn(
            "rounded-xl border border-neutral-200 bg-white min-h-0 flex-col overflow-hidden",
            activeId ? "flex" : "hidden lg:flex",
          )}
        >
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                compact
                icon={<Icon icon={Message01Icon} size={22} strokeWidth={1.8} />}
                title="Select a conversation"
                description="Pick a thread on the left to read and reply."
              />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  aria-label="Back to conversations"
                  className="inline-flex size-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 lg:hidden"
                >
                  <Icon icon={ArrowLeft02Icon} size={17} strokeWidth={1.8} />
                </button>
                <Avatar src={activeCounterpart?.image ?? null} name={activeCounterpart?.name ?? "Conversation"} size="md" alt="" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{activeCounterpart?.name ?? "Conversation"}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {active.contractId ? "Contract conversation" : "Direct message"}
                  </p>
                </div>
                {active.contractId ? (
                  <Button href="/freelancer/contracts" variant="secondary" size="sm" className="shrink-0">
                    View contract
                  </Button>
                ) : null}
              </div>

              {/* Bubbles */}
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-neutral-50/50 px-4 py-4 sm:px-6">
                {messagesLoading && messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-neutral-500">Loading messages</p>
                ) : null}
                {groupByDay(messages).map(([day, dayMessages]) => (
                  <div key={day}>
                    <div className="my-3 flex items-center gap-3" aria-hidden>
                      <span className="h-px flex-1 bg-neutral-200" />
                      <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{day}</span>
                      <span className="h-px flex-1 bg-neutral-200" />
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {dayMessages.map((message) => {
                        const mine = message.senderId === myId;
                        return (
                          <div key={message.id} className={cn("flex max-w-[85%] flex-col sm:max-w-[70%]", mine ? "self-end" : "self-start")}>
                            <div
                              className={cn(
                                "px-3.5 py-2.5 text-sm leading-relaxed",
                                mine
                                  ? "rounded-2xl rounded-br-sm bg-brand-600 text-white"
                                  : "rounded-2xl rounded-bl-sm border border-neutral-200 bg-white text-neutral-800",
                              )}
                            >
                              {message.isDeleted ? (
                                <span className={cn("italic", mine ? "text-white/80" : "text-neutral-500")}>
                                  This message was deleted
                                </span>
                              ) : (
                                message.body
                              )}
                            </div>
                            <span className={cn("mt-1 inline-flex items-center gap-1 text-[10px] text-neutral-400", mine && "justify-end")}>
                              {formatDateShort(message.createdAt)}
                              {mine ? <Icon icon={CheckmarkCircle02Icon} size={11} strokeWidth={2} className="text-brand-600" /> : null}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {!messagesLoading && messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-neutral-500">No messages yet. Say hello.</p>
                ) : null}
              </div>

              {/* Composer */}
              <form
                className="flex items-center gap-2 border-t border-neutral-100 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <Input
                  id="message-input"
                  aria-label="Type a message"
                  placeholder="Write a message"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <Button type="submit" size="md" disabled={draft.trim().length === 0 || sending} aria-label="Send message">
                  <Icon icon={SentIcon} size={15} strokeWidth={1.8} />
                  <span className="hidden sm:inline">{sending ? "Sending" : "Send"}</span>
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function groupByDay(messages: ConversationMessage[]): [string, ConversationMessage[]][] {
  const groups = new Map<string, ConversationMessage[]>();
  for (const message of messages) {
    const day = new Date(message.createdAt).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    const bucket = groups.get(day);
    if (bucket) bucket.push(message);
    else groups.set(day, [message]);
  }
  return [...groups.entries()];
}
