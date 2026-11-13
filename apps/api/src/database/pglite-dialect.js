import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
/**
 * PGlite embedded adapter.
 *
 * Kysely ships a built-in `PGliteDialect` (in kysely/dist) but does not export it from
 * the package exports map in any released version. Loading it through an explicit file
 * URL bypasses the exports restriction and works identically under tsx (from src/) and
 * compiled output (dist/), since both layouts resolve ../../node_modules to the app one.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const candidateRoots = [path.resolve(here, "../../node_modules"), path.resolve(here, "../node_modules")];
export async function createPGliteDialect(dataDir) {
    const errors = [];
    for (const root of candidateRoots) {
        const dialectPath = path.join(root, "kysely", "dist", "dialect", "pglite", "pglite-dialect.js");
        try {
            const module = (await import(pathToFileURL(dialectPath).href));
            const { PGlite } = await import("@electric-sql/pglite");
            if (dataDir === "memory://") {
                return new module.PGliteDialect({ pglite: new PGlite() });
            }
            return new module.PGliteDialect({ pglite: new PGlite(dataDir) });
        }
        catch (error) {
            errors.push(`${dialectPath}: ${error.message}`);
        }
    }
    throw new Error(`Unable to load the embedded PGlite dialect:\n${errors.join("\n")}`);
}
