"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/ui/logo";
import { Icon, Download01Icon, MultiplicationSignIcon, Share01Icon } from "@/lib/icons";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "workora-install-dismissed-at";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Registers the app-shell service worker and offers a compact install card
 * when the browser says the site is installable. On iOS (which has no
 * beforeinstallprompt event) we show the Add to Home Screen instructions.
 * Renders nothing when already running as an installed app or when dismissed.
 */
export function InstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Install prompts still work without SW caching; never break the page.
      });
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );

    try {
      const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_DURATION_MS) setDismissed(true);
    } catch {
      // Private mode / disabled storage — just show the prompt.
    }
  }, []);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setDismissed(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (isStandalone || dismissed || (!deferred && !isIOS)) return null;

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      // The browser may reject the prompt; leave the card in place.
    }
    setDeferred(null);
  }

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore storage failures
    }
    setDismissed(true);
  }

  return (
    <div
      role="dialog"
      aria-label="Install Workora"
      className="fixed bottom-4 left-4 z-50 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-neutral-200 bg-white p-4 shadow-dropdown anim-pop"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        <Icon icon={MultiplicationSignIcon} size={16} strokeWidth={1.8} />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <LogoMark size={40} className="mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">Install Workora</p>
          {isIOS ? (
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Tap <Icon icon={Share01Icon} size={13} strokeWidth={1.8} className="inline-block align-[-2px]" /> Share,
              then <span className="font-medium text-neutral-700">Add to Home Screen</span>.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                Get quick access to projects, messages and contracts from your home screen.
              </p>
              <button
                type="button"
                onClick={() => void install()}
                className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                <Icon icon={Download01Icon} size={15} strokeWidth={1.8} />
                Install app
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
