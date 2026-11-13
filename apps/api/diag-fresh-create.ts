import pg from "pg";
const admin = new pg.Client({ connectionString: "postgresql://postgres@localhost:5432/postgres" });
await admin.connect();
const exists = await admin.query("select 1 from pg_database where datname = 'workora_fresh_audit'");
if (exists.rowCount) await admin.query("DROP DATABASE workora_fresh_audit");
await admin.query("CREATE DATABASE workora_fresh_audit");
console.log("created workora_fresh_audit");
await admin.end();
