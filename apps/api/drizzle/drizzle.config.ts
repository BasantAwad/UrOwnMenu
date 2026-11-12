import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config for Cloudflare D1.
 *
 * The API itself talks to D1 through prepared statements, so this config is
 * used for schema typing and optional migration generation only.
 *
 * For local development:
 *   npx wrangler d1 migrations apply DB --local
 */
export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./drizzle/schema.ts",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CF_ACCOUNT_ID!,
    databaseId: process.env.D1_DATABASE_ID!,
    token: process.env.D1_API_TOKEN!,
  },
  verbose: true,
  strict: true,
});
