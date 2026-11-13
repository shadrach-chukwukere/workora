import "dotenv/config";
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const tables = await c.query(
  "select table_name from information_schema.tables where table_schema='public' order by 1"
);
console.log("tables:", tables.rows.map((r) => r.table_name).join(","));
for (const t of ["users", "payments", "contracts", "projects"]) {
  try {
    const r = await c.query(`select count(*)::int as n from ${t}`);
    console.log(t, "count:", r.rows[0].n);
  } catch {
    console.log(t, "count: <missing>");
  }
}
await c.end();
