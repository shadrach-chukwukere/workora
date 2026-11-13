import pg from "pg";
const c = new pg.Client({ connectionString: "postgresql://postgres@localhost:5432/workora_fresh_audit" });
await c.connect();
const t = await c.query("select table_name from information_schema.tables where table_schema='public' order by 1");
console.log("tables after full rollback:", t.rows.map((r) => r.table_name).join(",") || "(none)");
const f = await c.query("select proname from pg_proc where proname='set_updated_at'");
console.log("set_updated_at function exists:", f.rows.length > 0);
await c.end();
