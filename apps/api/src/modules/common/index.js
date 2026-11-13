import { requireAuth, requireAccountType, requirePermission } from "../../middleware/authenticate.js";
import { ok } from "../../utils/response.js";
export { requireAccountType, requireAuth, requirePermission, ok };
export function parsePage(query) {
    const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(query.perPage ?? query.limit ?? "20", 10) || 20));
    return { limit: perPage, offset: (page - 1) * perPage, page };
}
export function safeUser(user) {
    const { password: _p, failed_logins: _f, locked_until: _l, ...rest } = user;
    return rest;
}
