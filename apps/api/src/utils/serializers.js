/** Strips sensitive fields (password hashes, lock counters) from arbitrary rows before they reach the client. */
export function publicUser(row) {
    const { password, access_token, refresh_token, id_token, failed_logins, locked_until, scope, ...rest } = row;
    void password;
    void access_token;
    void refresh_token;
    void id_token;
    void failed_logins;
    void locked_until;
    void scope;
    return rest;
}
