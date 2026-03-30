import { applySchema } from "./applySchema.js";
import { pool } from "./pool.js";

async function migrate() {
  await applySchema(pool);
  console.log("Migration applied.");
  await pool.end();
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
