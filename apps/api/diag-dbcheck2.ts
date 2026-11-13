import "dotenv/config";
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const users = await c.query("select id, email, account_type, created_at from users order by created_at");
console.log(users.rows);
await c.end();
