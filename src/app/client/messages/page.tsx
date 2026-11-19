"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-blocks";
import {
  ArrowLeft02Icon,
  AttachmentIcon,
  File01Icon,
  Icon,
  Message01Icon,
  Search01Icon,
  SentIcon,
} from "@/lib/icons";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ConversationCounterpart {
  id: string;
  name: string | null;
  image: string | null;
}

interface ConversationListItem {
  id: string;
  kind: "direct" | "contract";
  contractId: string | null;
  createdAt: string;
  isMuted: boolean;
  lastReadAt: string | null;
  lastMessage: { id: string; senderId: string; body: string; createdAt: string; isDeleted: boolean } | null;
  unreadCount: number;
  participants: ConversationCounterpart[];
  counterparts: ConversationCounterpart[];
}

interface MessageAttachment {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender: { id: string; name: string | null; image: string | null } | null;
  body: string;
  editedAt: string | null;
  deletedAt: string | null;
  isDeleted: boolean;
  createdAt: string;
  attachments: MessageAttachment[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function ThreadRow({
  item,
  active,
  unread,
  onSelect,
}: {
  item: ConversationListItem;
  active: boolean;
  unread: number;
  onSelect: () => void;
}) {
  const counterpart = item.counterparts[0];
  const name = counterpart?.name ?? "Unknown";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-start gap-3 border-b border-neutral-100 px-4 py-3.5 text-left transition-colors",
        active ? "bg-brand-50" : "hover:bg-neutral-50",
      )}
    >
      <Avatar src={counterpart?.image ?? undefined} name={name} size="md" alt="" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-neutral-900">{name}</span>
          <span className="shrink-0 text-[11px] text-neutral-400">
            {item.lastMessage ? formatRelative(item.lastMessage.createdAt) : ""}
          </span>
        </span>
        <span className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-neutral-400">{item.lastMessage?.body ?? "No messages yet"}</span>
          {unread > 0 ? <Badge tone="brand">{unread} unread</Badge> : null}
        </span>
      </span>
    </button>
  );
}

export default function ClientMessagesPage() {
  const router = useRouter();
  const [myId, setMyId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ConversationListItem[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [unreadByThread, setUnreadByThread] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [query, setQuery] = useState("");
  const [messagesById, setMessagesById] = useState<Record<string, ConversationMessage[]>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/conversations", { credentials: "include", cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const envelope = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: { conversations?: ConversationListItem[] } }
        | null;
      if (envelope?.success && envelope.data?.conversations) {
        setThreads(envelope.data.conversations);
        setUnreadByThread(Object.fromEntries(envelope.data.conversations.map((c) => [c.id, c.unreadCount])));
      }
    } catch {
      toast.error("Could not load conversations", { description: "Network error. Please try again." });
    } finally {
      setLoadingThreads(false);
    }
  }, [router]);

  useEffect(() => {
    void loadConversations();
    void (async () => {
      try {
        const res = await fetch("/api/v1/users/me", { credentials: "include", cache: "no-store" });
        const envelope = (await res.json().catch(() => null)) as { success?: boolean; data?: { user?: { id: string } } } | null;
        if (envelope?.success && envelope.data?.user?.id) setMyId(envelope.data.user.id);
      } catch {
        // best effort; bubble alignment degrades to left for unknown sender
      }
    })();
  }, [loadConversations]);

  const filteredThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) =>
      t.counterparts.some((c) => (c.name ?? "").toLowerCase().includes(q)),
    );
  }, [threads, query]);

  const selected = selectedId ? threads.find((t) => t.id === selectedId) ?? null : null;
  const messages = selectedId ? messagesById[selectedId] ?? [] : [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, selectedId]);

  async function openThread(id: string) {
    setSelectedId(id);
    setMobileView("thread");
    setUnreadByThread((prev) => (prev[id] ? { ...prev, [id]: 0 } : prev));
    setLoadingMessages(true);
    try {
      const [messagesRes] = await Promise.all([
        fetch(`/api/v1/conversations/${encodeURIComponent(id)}/messages`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/v1/conversations/${encodeURIComponent(id)}/read`, { method: "POST", credentials: "include" }),
      ]);
      if (messagesRes.status === 401 || messagesRes.status === 403) {
        router.push("/login");
        return;
      }
      const envelope = (await messagesRes.json().catch(() => null)) as
        | { success?: boolean; data?: { messages?: ConversationMessage[] } }
        | null;
      const rows = envelope?.data?.messages ?? [];
      /* API returns newest first; render oldest at the top. */
      setMessagesById((prev) => ({ ...prev, [id]: [...rows].reverse() }));
    } catch {
      toast.error("Could not load messages", { description: "Network error. Please try again." });
    } finally {
      setLoadingMessages(false);
    }
  }

  async function sendMessage() {
    if (!selected) return;
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/v1/conversations/${encodeURIComponent(selected.id)}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const envelope = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: { message?: ConversationMessage }; message?: string }
        | null;
      if (!res.ok || !envelope?.success || !envelope.data?.message) {
        toast.error("Message not sent", { description: envelope?.message ?? "The server rejected the message." });
        return;
      }
      const sent = envelope.data.message;
      setMessagesById((prev) => ({ ...prev, [selected.id]: [...(prev[selected.id] ?? []), sent] }));
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selected.id
            ? { ...t, lastMessage: { id: sent.id, senderId: sent.senderId, body: sent.body, createdAt: sent.createdAt, isDeleted: sent.isDeleted } }
            : t,
        ),
      );
      setDraft("");
    } catch {
      toast.error("Message not sent", { description: "Network error. Please try again." });
    } finally {
      setSending(false);
    }
  }

  const totalUnread = Object.values(unreadByThread).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Messages"
        description={totalUnread > 0 ? `${totalUnread} unread across your conversations with freelancers.` : "Every conversation with your freelancers, in one place."}
      />

      <div className="card grid h-[560px] grid-cols-1 overflow-hidden lg:grid-cols-[360px_1fr]">
        {/* Thread list */}
        <div className={cn("flex min-h-0 flex-col border-r border-neutral-100", mobileView === "thread" ? "hidden lg:flex" : "flex")}>
          <div className="border-b border-neutral-100 p-3">
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <Icon icon={Search01Icon} size={15} strokeWidth={1.8} />
              </span>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search freelancers"
                aria-label="Search conversations"
                className="pl-9"
              />
            </div>
            <p className="mt-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Conversations ({threads.length})
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredThreads.map((item) => (
              <ThreadRow
                key={item.id}
                item={item}
                active={item.id === selectedId}
                unread={unreadByThread[item.id] ?? 0}
                onSelect={() => openThread(item.id)}
              />
            ))}
            {!loadingThreads && filteredThreads.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">
                {threads.length === 0 ? "No conversations yet. Starting one from a contract or proposal will show it here." : "No conversations match that search."}
              </p>
            ) : null}
          </div>
        </div>

        {/* Conversation */}
        <div className={cn("flex min-h-0 flex-col", mobileView === "list" ? "hidden lg:flex" : "flex")}>
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={<Icon icon={Message01Icon} size={20} strokeWidth={1.6} />}
                title="Select a conversation"
                description="Choose a thread on the left to read it and reply. Unread badges clear when you open a thread."
                variant="plain"
              />
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  aria-label="Back to conversations"
                  className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 lg:hidden"
                >
                  <Icon icon={ArrowLeft02Icon} size={18} strokeWidth={1.8} />
                </button>
                <Avatar src={selected.counterparts[0]?.image ?? undefined} name={selected.counterparts[0]?.name ?? "Unknown"} size="sm" alt="" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">{selected.counterparts[0]?.name ?? "Unknown"}</p>
                  <p className="truncate text-xs text-neutral-500">{selected.kind === "contract" ? "Contract conversation" : "Direct message"}</p>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-neutral-50/50 px-4 py-4">
                <ul className="flex flex-col gap-3">
                  {messages.map((message) => {
                    const mine = message.senderId === myId;
                    return (
                      <li key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed sm:max-w-[70%]",
                            mine
                              ? "rounded-br-md bg-brand-600 text-white"
                              : "rounded-bl-md border border-neutral-200 bg-white text-neutral-800",
                          )}
                        >
                          <p className={cn("whitespace-pre-line", message.isDeleted && "italic opacity-70")}>
                            {message.isDeleted ? "Message deleted" : message.body}
                          </p>
                          {message.attachments.map((file) => (
                            <a
                              key={file.id}
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                "mt-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] underline-offset-2 hover:underline",
                                mine ? "bg-brand-700/60 text-brand-50" : "border border-neutral-200 bg-neutral-50 text-neutral-600",
                              )}
                            >
                              <Icon icon={File01Icon} size={13} strokeWidth={1.8} />
                              <span className="max-w-48 truncate">{file.fileName}</span>
                              <span className="shrink-0 opacity-70">{formatBytes(file.sizeBytes)}</span>
                            </a>
                          ))}
                          <p className={cn("mt-1.5 text-[10px]", mine ? "text-brand-100" : "text-neutral-400")}>
                            {formatDateTime(message.createdAt)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                  {loadingMessages ? <li className="py-8 text-center text-sm text-neutral-400">Loading messages…</li> : null}
                  {!loadingMessages && messages.length === 0 ? (
                    <li className="py-8 text-center text-sm text-neutral-400">No messages yet. Say hello.</li>
                  ) : null}
                </ul>
              </div>

              {/* Composer */}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMessage();
                }}
                className="flex items-center gap-2 border-t border-neutral-100 px-4 py-3"
              >
                <button
                  type="button"
                  aria-label="Attach a file"
                  onClick={() => toast.info("File attachments are not available in this demo workspace.")}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
                >
                  <Icon icon={AttachmentIcon} size={18} strokeWidth={1.8} />
                </button>
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Message ${(selected.counterparts[0]?.name ?? "freelancer").split(" ")[0]}`}
                  aria-label="Message"
                  className="flex-1"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={!draft.trim() || sending}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
                >
                  <Icon icon={SentIcon} size={17} strokeWidth={1.8} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
