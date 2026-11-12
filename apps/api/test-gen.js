import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

const auth = betterAuth({
  database: drizzleAdapter(),
  schemaPath: "./drizzle/schema.ts",
  serverURL: "http://localhost:5173",
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {},
});

export default auth;
console.log("Better Auth initialized with drizzle adapter");