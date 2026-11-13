import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { migrate } from "./database/migrate.js";

/** Process entrypoint. Runs pending migrations, then listens. */
async function main() {
  await migrate();

  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
