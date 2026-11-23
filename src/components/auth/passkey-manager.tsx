"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BiometricAccessIcon, Icon, TrashIcon } from "@/lib/icons";
import { createPasskey, isWebAuthnSupported } from "@/lib/webauthn";

interface Passkey {
  id: string;
  credentialId: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

/** Lets signed-in users add/remove passkeys without exposing any raw credential data. */
export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const load = useCallback(async () => {
    setSupported(isWebAuthnSupported());
    try {
      const res = await fetch("/api/v1/passkeys", {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => null)) as Envelope<{ passkeys: Passkey[] }> | null;
      if (!res.ok || !body?.success) throw new Error(body?.message ?? "Could not load passkeys");
      setPasskeys(body.data.passkeys);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load passkeys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAdd() {
    setAdding(true);
    try {
      await createPasskey();
      await load();
      toast.success("Passkey added. You can now sign in with your device.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add a passkey");
    } finally {
      setAdding(false);
    }
  }

  async function onRemove(passkey: Passkey) {
    setRemovingId(passkey.id);
    try {
      const res = await fetch(`/api/v1/passkeys/${passkey.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as Envelope<null> | null;
      if (!res.ok || !body?.success) throw new Error(body?.message ?? "Could not remove passkey");
      await load();
      toast.success("Passkey removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove passkey");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Icon icon={BiometricAccessIcon} size={19} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Passkeys</h2>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-neutral-500">
              Sign in with your fingerprint, face, PIN or security key. Your biometric data never
              leaves your device — Workora only stores a public key.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={adding}
          disabled={!supported || adding}
          onClick={onAdd}
        >
          {adding ? "Adding…" : "Add a passkey"}
        </Button>
      </div>

      {!supported ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="alert">
          Passkeys need HTTPS (or localhost) and a browser that supports WebAuthn.
        </p>
      ) : null}

      <div className="mt-5">
        {loading ? (
          <p className="text-xs text-neutral-500">Loading passkeys…</p>
        ) : passkeys.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-center text-xs text-neutral-500">
            No passkeys yet. Add one to sign in without a password.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="flex items-center gap-3 px-3 py-2.5">
                <Icon icon={BiometricAccessIcon} size={16} strokeWidth={1.8} className="text-brand-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-neutral-800">
                    {passkey.deviceType === "multi_device" ? "Synced passkey" : "This device"}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Added {new Date(passkey.createdAt).toLocaleDateString()}
                    {passkey.backedUp ? " · Backed up" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onRemove(passkey)}
                  disabled={removingId === passkey.id}
                  aria-label="Remove passkey"
                  className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  <Icon icon={TrashIcon} size={15} strokeWidth={1.8} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
