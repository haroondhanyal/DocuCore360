import "dotenv/config";
import { db } from "../src/server/db";
import { cleanup } from "../src/server/services/cleanup";
cleanup()
  .then((result) =>
    console.log(
      `Cleanup complete: ${result.files} expired files, ${result.sessions} sessions, ${result.tokens} tokens removed.`,
    ),
  )
  .catch(() => {
    console.error("Cleanup failed. Check database/storage permissions.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
