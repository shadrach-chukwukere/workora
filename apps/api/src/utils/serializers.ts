/** Strips sensitive fields (password hashes, lock counters) from arbitrary rows before they reach the client. */
export function publicUser<T extends Record<string, unknown>>(row: T): T {
  const {
    password, access_token, refresh_token, id_token, failed_logins, locked_until, scope, ...rest
  } = row as T & { password?: unknown; access_token?: unknown; refresh_token?: unknown; id_token?: unknown; failed_logins?: unknown; locked_until?: unknown; scope?: unknown };
  void password; void access_token; void refresh_token; void id_token; void failed_logins; void locked_until; void scope;
  return rest as T;
}
