import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./drizzle";
import { user, session as sessionTable, account as accountTable, verification as verificationTable } from "./schema";

// Better Auth with D1 database adapter
export const auth = betterAuth({
  database: drizzleAdapter({
    // Pass the D1 drizzle db instance
    // The adapter will use the same connection
    provider: "sqlite", // D1 is SQLite-compatible
  }),
  schema: {
    // Override table names to match our D1 schema
    user: user,
    session: sessionTable,
    account: accountTable,
    verification: verificationTable,
  },
  serverURL: "http://localhost:5173",
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {},
});

// Export the db for use in API routes
export { db };