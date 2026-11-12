import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.json({ hello: "world" });
});

app.post("/api/test", (c) => {
  return c.json({ status: "ok" });
});

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};