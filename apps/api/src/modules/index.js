import { existsSync } from "node:fs";
const routeModules = [
    { name: "users", path: "./users/routes.js" },
    { name: "categories", path: "./categories/routes.js" },
    { name: "projects", path: "./projects/routes.js" },
    { name: "proposals", path: "./proposals/routes.js" },
    { name: "contracts", path: "./contracts/routes.js" },
    { name: "milestones", path: "./milestones/routes.js" },
    { name: "conversations", path: "./conversations/routes.js" },
    { name: "messages", path: "./messages/routes.js" },
    { name: "notifications", path: "./notifications/routes.js" },
    { name: "reviews", path: "./reviews/routes.js" },
    { name: "disputes", path: "./disputes/routes.js" },
    { name: "subscriptions", path: "./subscriptions/routes.js" },
    { name: "verification", path: "./verification/routes.js" },
    { name: "payments", path: "./payments/routes.js" },
    { name: "admin", path: "./admin/routes.js" },
    { name: "reports", path: "./reports/routes.js" },
    { name: "freelancers", path: "./freelancers/routes.js" },
    { name: "clients", path: "./clients/routes.js" },
];
export async function registerModules(app) {
    const registered = [];
    const skipped = [];
    for (const mod of routeModules) {
        const sourceUrl = new URL(mod.path, import.meta.url);
        const tsUrl = new URL(mod.path.replace(/\.js$/, ".ts"), import.meta.url);
        if (!existsSync(tsUrl) && !existsSync(sourceUrl)) {
            skipped.push(mod.name);
            continue;
        }
        const routes = (await import((existsSync(tsUrl) ? tsUrl : sourceUrl).href)).default;
        await app.register(routes, { prefix: "/api/v1" });
        registered.push(mod.name);
    }
    if (skipped.length > 0) {
        app.log.warn({ skipped }, "modules/index: skipping modules that are not built in this workspace yet");
    }
    app.log.info({ registered }, "modules/index: registered");
}
