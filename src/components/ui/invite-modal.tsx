"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Icon } from "@/lib/icons";

interface InviteToProjectModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (freelancerId: string, message: string) => void;
  projectId: string;
  projectTitle: string;
}

export function InviteToProjectModal({
  open,
  onClose,
  onInvite,
  projectId,
  projectTitle,
}: InviteToProjectModalProps) {
  const [freelancerId, setFreelancerId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!freelancerId || !UUID(freelancerId)) {
      toast.error("Please enter a valid freelancer ID");
      return;
    }
    if (freelancerId === "") {
      toast.error("Please enter a freelancer ID");
      return;
    }
    setLoading(true);
    try {
      await onInvite(freelancerId, message);
      toast.success("Invitation sent");
      onClose();
    } catch (e) {
      toast.error("Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite a Freelancer">
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">
          Send an invitation to a freelancer to submit a proposal on <strong>{projectTitle}</strong>.
        </p>

        <div>
          <label className="sr-only">Freelancer ID</label>
          <Input
            type="text"
            placeholder="Freelancer ID (e.g. freelancer-uuid)"
            value={freelancerId}
            onChange={(e) => setFreelancerId(e.target.value)}
            disabled={loading}
            className={cn(
              "block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 hover:border-neutral-300",
              "disabled:bg-neutral-100 disabled:text-neutral-400"
            )}
            aria-describedby="freelancer-id-help"
          />
          <p id="freelancer-id-help" className="mt-1 text-[10px] text-neutral-500">
            Get the freelancer's ID from their profile page.
          </p>
        </div>

        <div>
          <label className="sr-only">Message</label>
          <Textarea
            placeholder="Optional personal message (max 1200 chars)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
            rows={3}
            className={cn(
              "block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 hover:border-neutral-300",
              "disabled:bg-neutral-100 disabled:text-neutral-400"
            )}
            maxLength={1200}
          />
        </div>

        {loading && (
          <div className="mt-3 flex justify-center">
            <span className="animation-spin rounded-full h-4 w-4 border-b border-brand-600"></span>
            <span className="ml-2 text-xs text-neutral-500">Sending…</span>
          </div>
        )}
      </div>

      <footer className="flex gap-3 pt-4 border-t border-neutral-100">
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleInvite}
          size="sm"
          disabled={loading}
          className="bg-brand-600 text-white hover:bg-brand-700"
        >
          {loading ? "Sending…" : "Send Invitation"}
        </Button>
      </footer>
    </Modal>
  );
}

function UUID(haystack: string) {
  return /^[0-9a-fA-F-]{36}$/.test(haystack);
}