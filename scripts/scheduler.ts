import "dotenv/config";
import { db } from "../src/server/db";
import { cleanup } from "../src/server/services/cleanup";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function run() {
  while (!stopping) {
    try {
      const result = await cleanup();
      console.log(JSON.stringify({ event: "cleanup", at: new Date().toISOString(), ...result }));
    } catch {
      console.error(JSON.stringify({ event: "cleanup_failed", at: new Date().toISOString() }));
    }
    for (let i = 0; i < 60 && !stopping; i++) await new Promise((r) => setTimeout(r, 1000));
  }
}
run().finally(() => db.$disconnect());
