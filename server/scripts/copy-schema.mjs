import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destDir = join(root, "dist", "db");
mkdirSync(destDir, { recursive: true });
copyFileSync(join(root, "src", "db", "schema.sql"), join(destDir, "schema.sql"));
