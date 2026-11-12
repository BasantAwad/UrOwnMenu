import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { D1Database } from "better-auth/cloudflare-d1";

const auth = betterAuth({
  database: drizzleAdapter(),
  serverURL: "http://localhost:5173",
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {},
});

// The generate function should create the migration
// Let's just check if better-auth has a generate command available
console.log("Better Auth initialized");
console.log("Database adapter:", auth.database ? "drizzle adapter" : "none");