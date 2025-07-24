import { createDatabase, initializeDatabase } from "../database/sqlite3.ts";
import { DatabaseConfig } from "../src/database-config.ts";

let testDbCounter = 0;

export async function createTestDatabase() {
  testDbCounter++;
  const testDbPath = `test_db_${testDbCounter}_${Date.now()}.sqlite3`;

  // Create a fresh database instance for testing
  const testDb = createDatabase(testDbPath);

  // Initialize the test database
  await initializeDatabase(testDb);

  // Create a DatabaseConfig instance using the test database
  const testDbConfig = DatabaseConfig.createInstance(testDb);

  return {
    dbInstance: testDb,
    dbConfig: testDbConfig,
    dbPath: testDbPath,
    async cleanup() {
      try {
        await Deno.remove(testDbPath);
      } catch {
        // File might not exist, that's fine
      }
    },
  };
}
