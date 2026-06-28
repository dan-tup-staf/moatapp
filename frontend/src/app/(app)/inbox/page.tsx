"use client";

import { FormEvent, useEffect, useState } from "react";
import { Inbox, Mail, Send } from "lucide-react";

import { api, ApiError, InboxMessage } from "@/lib/api-client";

const AVATARS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
];

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  async function refresh() {
    try {
      setMessages(await api.inbox.list(unreadOnly));
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

  async function open(m: InboxMessage) {
    setSelected(m);
    if (!m.is_read) {
      try {
        await api.inbox.markRead(m.id, true);
        setMessages((prev) =>
          prev.map((x) => (x.id === m.id ? { ...x, is_read: true } : x)),
        );
      } catch {
        /* ignore */
      }
    }
  }

  const unread = messages.filter((m) => !m.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Skrzynka</h2>
          <p className="mt-1 text-sm text-gray-600">
            Odpowiedzi od prospektów — czytaj i odpisuj bez wychodzenia z MOATION.
            {unread > 0 && (
              <span className="ml-1 font-medium text-gray-900">
                {unread} nieprzeczytanych
              </span>
            )}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="h-4 w-4"
          />
          Tylko nieprzeczytane
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Ładowanie…</p>
      ) : messages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            Brak odpowiedzi. Gdy prospekt odpisze na kampanię (a skrzynka ma
            podłączony IMAP), wiadomość pojawi się tutaj.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
          {/* List */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">
              {messages.map((m, i) => {
                const name = m.lead_name || m.from_email;
                const ini =
                  (name[0] || "?").toUpperCase() +
                  (name.split(" ")[1]?.[0]?.toUpperCase() ?? "");
                const active = selected?.id === m.id;
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => open(m)}
                      className={
                        "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition " +
                        (active ? "bg-gray-50" : "hover:bg-gray-50")
                      }
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                          AVATARS[i % AVATARS.length]
                        }`}
                      >
                        {ini}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {!m.is_read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                          )}
                          <span
                            className={
                              "truncate text-sm " +
                              (m.is_read
                                ? "text-gray-700"
                                : "font-semibold text-gray-900")
                            }
                          >
                            {name}
                          </span>
                        </div>
                        <p className="truncate text-xs text-gray-500">
                          {m.subject || "(bez tematu)"}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Detail */}
          {selected ? (
            <MessageDetail
              key={selected.id}
              message={selected}
              onSent={refresh}
            />
          ) : (
            <div className="hidden items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400 lg:flex">
              Wybierz wiadomość, aby ją przeczytać i odpisać.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageDetail({
  message,
  onSent,
}: {
  message: InboxMessage;
  onSent: () => void;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.inbox.reply(message.id, reply);
      setSent(true);
      setReply("");
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd wysyłki");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-gray-400" />
          <h3 className="font-semibold text-gray-900">
            {message.subject || "(bez tematu)"}
          </h3>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Od: <span className="font-medium">{message.from_email}</span>
          {message.lead_company && ` · ${message.lead_company}`}
          {message.received_at &&
            ` · ${new Date(message.received_at).toLocaleString("pl-PL")}`}
        </p>
      </div>
      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap p-4 text-sm text-gray-800">
        {message.body || "(pusta treść)"}
      </div>
      <form onSubmit={send} className="border-t border-gray-100 p-4">
        <textarea
          required
          value={reply}
          onChange={(e) => {
            setReply(e.target.value);
            setSent(false);
          }}
          rows={4}
          placeholder="Twoja odpowiedź…"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        {sent && (
          <p className="mt-1 text-sm text-emerald-600">Odpowiedź wysłana ✓</p>
        )}
        <button
          disabled={sending || !reply.trim()}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {sending ? "Wysyłam…" : "Wyślij odpowiedź"}
        </button>
      </form>
    </div>
  );
}
