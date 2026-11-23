/**
 * Client-side sign-out.
 *
 * The server call is same-origin so the Next.js rewrite forwards the real
 * Better Auth cookies (HttpOnly) to the API. After the session is deleted we
 * also expire any copies on this origin, clear browser storage, and finish
 * with a full document navigation so React/router caches cannot show stale
 * signed-in UI.
 */

const SIGN_OUT_URL = "/api/auth/sign-out";
const CLEAR_SESSION_URL = "/api/session/clear";

const AUTH_STORAGE_PREFIXES = [
  "workora.",
  "workora:",
  "workora_",
  "better-auth.",
  "better-auth:",
  "better-auth_",
  "__secure-better-auth.",
  "auth.",
  "auth:",
  "auth_",
  "session.",
  "session:",
  "session_",
];

function clearBrowserAuthState() {
  if (typeof window === "undefined") return;

  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key) continue;
        const normalised = key.toLowerCase();
        if (
          AUTH_STORAGE_PREFIXES.some((prefix) => normalised.startsWith(prefix)) ||
          normalised === "workora" ||
          normalised === "auth" ||
          normalised === "session" ||
          normalised === "token"
        ) {
          keys.push(key);
        }
      }
      keys.forEach((key) => storage.removeItem(key));
    } catch {
      // Storage can be unavailable in private mode; the server sign-out is
      // still authoritative.
    }
  }
}

async function post(url: string, body?: unknown): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        // Better Auth can return a provider logout URL. We do not want fetch
        // following that cross-origin redirect before cookies are cleared.
        redirect: "manual",
        headers: {
          "content-type": "application/json",
          "x-requested-with": "fetch",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      return response.ok || response.type === "opaqueredirect";
    } finally {
      window.clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

/**
 * Erase the current login and force a fresh page load. Never throws: even if
 * the backend is unreachable, local cookies/storage are cleared and the user
 * is sent to the login page.
 */
export async function signOut(redirectTo = "/login"): Promise<void> {
  try {
    await post(SIGN_OUT_URL, { disableRedirect: true });
  } finally {
    // Belt-and-braces: expire cookies on this origin if the upstream response
    // was missed, then clear anything cached in the browser.
    await post(CLEAR_SESSION_URL);
    clearBrowserAuthState();
    window.location.replace(redirectTo);
  }
}
