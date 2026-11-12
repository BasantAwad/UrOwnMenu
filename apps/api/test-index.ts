import { Hono } from "hono";
import { drizzle, type D1Database } from "drizzle-orm/d1";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/api/test", (c) => {
  return c.json({ message: "API is working" });
});

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};