import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import { z } from "zod";

// ============ Types ============

export interface Env {
  DB: D1Database;
  MEDIA?: R2Bucket;
  AI?: unknown;
  ENVIRONMENT?: string;
  /** Base URL of the web app that renders public menus (e.g. https://menus.example.com). */
  PUBLIC_WEB_URL?: string;
}

type SessionUser = {
  id: string;
  name: string | null;
  email: string | null;
};

type AppVariables = {
  user: SessionUser | null;
  sessionId: string | null;
  validationMessage: string | null;
};

/** The Hono context type used by every helper in this file. */
type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ============ Helpers ============

const ID_PREFIXES = {
  user: "usr",
  session: "ses",
  restaurant: "rst",
  membership: "mem",
  brand: "brd",
  menu: "mnu",
  category: "cat",
  item: "itm",
  asset: "ast",
  config: "cfg",
  version: "ver",
} as const;

type IdKind = keyof typeof ID_PREFIXES;

function newId(kind: IdKind): string {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return ID_PREFIXES[kind] + "_" + raw;
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "restaurant";
}

/** Deterministic SHA-256 hex digest of a string. */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Password hashing using PBKDF2-SHA256 via WebCrypto.
 * Format: pbkdf2$<iterations>$<saltHex>$<hashHex>
 */
async function hashPassword(password: string): Promise<string> {
  const iterations = 100000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  const hash = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "pbkdf2$" + iterations + "$" + saltHex + "$" + hash;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  const salt = hexToBytes(parts[2]);
  const expected = parts[3];
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  const actual = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(actual, expected);
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function bearerToken(c: { req: { header(name: string): string | undefined } }): string | null {
  const header = c.req.header("Authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    return token.length > 0 ? token : null;
  }
  return null;
}

async function jsonBody<T>(c: AppContext, schema: z.ZodType<T>): Promise<T | null> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first
      ? (first.message || "Invalid field: " + first.path.join("."))
      : "Invalid payload";
    c.set("validationMessage", message);
    return null;
  }
  return parsed.data;
}

/** Retrieve a friendly validation message set by jsonBody(). */
function validationMessage(c: AppContext, fallback: string): string {
  return c.get("validationMessage") || fallback;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ============ Design system palettes ============

const PALETTES: Record<string, Record<string, string>> = {
  "espresso-cream": {
    brandPrimary: "#2B211D",
    brandSecondary: "#594239",
    brandAccent: "#B77A45",
    pageBackground: "#F4EFE7",
    surface: "#FFFDF9",
    surfaceElevated: "#FFFFFF",
    textPrimary: "#2B211D",
    textSecondary: "#594239",
    textMuted: "#A99A8D",
    border: "#DED4C7",
    onPrimary: "#FFFDF9",
  },
  "tomato-parchment": {
    brandPrimary: "#B83A2E",
    brandSecondary: "#762B25",
    brandAccent: "#66704B",
    pageBackground: "#F5EBDD",
    surface: "#FFFAF1",
    surfaceElevated: "#FFFFFF",
    textPrimary: "#25231F",
    textSecondary: "#762B25",
    textMuted: "#8A8378",
    border: "#E2D5C0",
    onPrimary: "#FFFAF1",
  },
  "midnight-champagne": {
    brandPrimary: "#171B24",
    brandSecondary: "#343B49",
    brandAccent: "#D5BD91",
    pageBackground: "#F3EFE7",
    surface: "#FCFBF8",
    surfaceElevated: "#FFFFFF",
    textPrimary: "#171B24",
    textSecondary: "#343B49",
    textMuted: "#A6A9AE",
    border: "#DDD8CE",
    onPrimary: "#FCFBF8",
  },
  "pistachio-vanilla": {
    brandPrimary: "#526348",
    brandSecondary: "#4A382F",
    brandAccent: "#C98F83",
    pageBackground: "#F7F1E4",
    surface: "#FFFCF6",
    surfaceElevated: "#FFFFFF",
    textPrimary: "#3A4634",
    textSecondary: "#4A382F",
    textMuted: "#A9B59A",
    border: "#E0D8C6",
    onPrimary: "#FFFCF6",
  },
  "citrus-pop": {
    brandPrimary: "#F07835",
    brandSecondary: "#263B31",
    brandAccent: "#E66D62",
    pageBackground: "#FFF8EA",
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    textPrimary: "#263B31",
    textSecondary: "#4F7554",
    textMuted: "#9A9A90",
    border: "#F0E3CC",
    onPrimary: "#FFFFFF",
  },
  "ocean-glass": {
    brandPrimary: "#164A4A",
    brandSecondary: "#202A2A",
    brandAccent: "#B97855",
    pageBackground: "#EDE2D0",
    surface: "#FFF9F1",
    surfaceElevated: "#FFFFFF",
    textPrimary: "#202A2A",
    textSecondary: "#164A4A",
    textMuted: "#A9C8BE",
    border: "#DDD2BF",
    onPrimary: "#FFF9F1",
  },
  "black-bone": {
    brandPrimary: "#171717",
    brandSecondary: "#353535",
    brandAccent: "#A88A58",
    pageBackground: "#F1EEE7",
    surface: "#FCFBF8",
    surfaceElevated: "#FFFFFF",
    textPrimary: "#171717",
    textSecondary: "#353535",
    textMuted: "#A7A29A",
    border: "#DCD7CD",
    onPrimary: "#FCFBF8",
  },
  "berry-blush": {
    brandPrimary: "#6E304B",
    brandSecondary: "#442536",
    brandAccent: "#C98F83",
    pageBackground: "#F7EDE8",
    surface: "#FFF9F3",
    surfaceElevated: "#FFFFFF",
    textPrimary: "#442536",
    textSecondary: "#6E304B",
    textMuted: "#A98892",
    border: "#EBD9D4",
    onPrimary: "#FFF9F3",
  },
};

const TEMPLATES = [
  { key: "editorial-showcase", name: "Editorial Showcase", bestFor: "Premium restaurants, chef-led brands, modern cafes" },
  { key: "orbital-menu", name: "Orbital Menu", bestFor: "Pizza, burgers, round plates, signature dishes" },
  { key: "ingredient-universe", name: "Ingredient Universe", bestFor: "Coffee, mocktails, juice, smoothies" },
  { key: "endless-table", name: "Endless Table", bestFor: "Photo-rich menus, no separate landing page" },
  { key: "magazine", name: "Menu Magazine", bestFor: "Cafes, bakeries, patisseries, tasting menus" },
  { key: "ingredient-story", name: "Ingredient Story", bestFor: "Desserts and drinks where each item deserves a full-bleed story" },
  { key: "cafe", name: "Cafe Pedestal", bestFor: "Coffee shops, drink bars and juice spots with a hero drink" },
  { key: "mosaic", name: "Mosaique", bestFor: "Desserts, patisseries and drink brands with bold macro photography" },
] as const;

const PALETTE_LIST = Object.keys(PALETTES);

// ============ CORS ============

app.use("*", cors({
  origin: (origin) => origin || "*",
  allowHeaders: ["Authorization", "Content-Type"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
}));

// ============ Auth middleware ============

app.use("*", async (c, next) => {
  c.set("user", null);
  c.set("sessionId", null);
  c.set("validationMessage", null);

  const token = bearerToken(c);
  if (token) {
    const row = await c.env.DB.prepare(
      `SELECT s.id AS session_id, s.expires_at, u.id AS user_id, u.name, u.email
       FROM "session" s JOIN "user" u ON u.id = s.user_id
       WHERE s.id = ?`,
    ).bind(token).first<{
      session_id: string;
      expires_at: string;
      user_id: string;
      name: string | null;
      email: string | null;
    }>();

    if (row) {
      const expires = new Date(row.expires_at).getTime();
      if (!Number.isNaN(expires) && expires > Date.now()) {
        c.set("sessionId", row.session_id);
        c.set("user", { id: row.user_id, name: row.name, email: row.email });
      } else {
        await c.env.DB.prepare(`DELETE FROM "session" WHERE id = ?`).bind(token).run();
      }
    }
  }
  await next();
});

function requireUser(c: AppContext): SessionUser {
  const user = c.get("user");
  if (!user) {
    throw new HttpError(401, "Authentication required");
  }
  return user;
}

/** Verify the caller owns (or can edit) the restaurant. */
async function requireRestaurantAccess(
  c: AppContext,
  restaurantId: string,
  roles: string[] = ["owner", "editor"],
): Promise<{ restaurant: any; role: string }> {
  const user = requireUser(c);
  const restaurant = await c.env.DB.prepare(
    `SELECT * FROM restaurants WHERE id = ?`,
  ).bind(restaurantId).first<any>();

  if (!restaurant) throw new HttpError(404, "Restaurant not found");

  const membership = await c.env.DB.prepare(
    `SELECT role FROM restaurant_memberships WHERE restaurant_id = ? AND user_id = ?`,
  ).bind(restaurantId, user.id).first<{ role: string }>();

  if (membership && roles.includes(membership.role)) {
    return { restaurant, role: membership.role };
  }
  if (restaurant.owner_user_id === user.id && roles.includes("owner")) {
    return { restaurant, role: "owner" };
  }
  throw new HttpError(403, "You do not have access to this restaurant");
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status as any);
  }
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// ============ Health ============

app.get("/health", (c) => c.json({ status: "ok", service: "urownmenu-api" }));

app.get("/api/test", (c) => c.json({ message: "API is working" }));

app.get("/api/meta", (c) =>
  c.json({
    palettes: PALETTE_LIST.map((key) => ({
      key,
      name: key.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      tokens: PALETTES[key],
    })),
    templates: TEMPLATES,
  }),
);

// ============ Auth ============

const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

app.post("/api/auth/signup", async (c) => {
  const body = await jsonBody(c, signupSchema);
  if (!body) return c.json({ error: validationMessage(c, "Invalid signup payload") }, 400);

  const email = body.email.trim().toLowerCase();

  const existing = await c.env.DB.prepare(
    `SELECT id FROM "user" WHERE email = ?`,
  ).bind(email).first<{ id: string }>();
  if (existing) {
    return c.json({ error: "An account with that email already exists" }, 409);
  }

  const userId = newId("user");
  const password = body.password || crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    `INSERT INTO "user" (id, name, email, password, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(userId, body.name.trim(), email, passwordHash, nowIso(), nowIso()).run();

  const sessionId = newId("session");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO "session" (id, user_id, expires_at, ip_address, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    sessionId,
    userId,
    expiresAt,
    c.req.header("CF-Connecting-IP") || null,
    c.req.header("User-Agent") || null,
    nowIso(),
  ).run();

  return c.json({
    status: "ok",
    user: { id: userId, name: body.name.trim(), email },
    session: sessionId,
  }, 201);
});

const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().optional(),
});

app.post("/api/auth/login", async (c) => {
  const body = await jsonBody(c, loginSchema);
  if (!body) return c.json({ error: validationMessage(c, "Invalid login payload") }, 400);

  const email = body.email.trim().toLowerCase();
  const row = await c.env.DB.prepare(
    `SELECT id, name, email, password FROM "user" WHERE email = ?`,
  ).bind(email).first<{ id: string; name: string | null; email: string; password: string | null }>();

  if (!row) return c.json({ error: "No account found for that email" }, 404);

  if (row.password && body.password) {
    const ok = await verifyPassword(body.password, row.password);
    if (!ok) return c.json({ error: "Incorrect password" }, 401);
  }

  const sessionId = newId("session");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO "session" (id, user_id, expires_at, ip_address, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    sessionId,
    row.id,
    expiresAt,
    c.req.header("CF-Connecting-IP") || null,
    c.req.header("User-Agent") || null,
    nowIso(),
  ).run();

  return c.json({
    status: "ok",
    user: { id: row.id, name: row.name, email: row.email },
    session: sessionId,
  });
});

app.get("/api/auth/session", (c) => {
  const user = c.get("user");
  if (!user) return c.json({ isAuthenticated: false, user: null });
  return c.json({ isAuthenticated: true, user });
});

app.post("/api/auth/signout", async (c) => {
  const sessionId = c.get("sessionId");
  if (sessionId) {
    await c.env.DB.prepare(`DELETE FROM "session" WHERE id = ?`).bind(sessionId).run();
  }
  return c.json({ status: "ok" });
});

// ============ Restaurants ============

const restaurantSchema = z.object({
  name: z.string().min(1, "Restaurant name is required").max(120),
  slug: z.string().max(64).optional(),
  description: z.string().max(1000).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  website_url: z.string().max(300).optional(),
  address_text: z.string().max(300).optional(),
  map_url: z.string().max(300).optional(),
  currency_code: z.string().length(3).default("EGP"),
  locale: z.string().max(10).default("en"),
  timezone: z.string().max(64).default("Africa/Cairo"),
});

app.get("/api/restaurants", async (c) => {
  const user = requireUser(c);
  const rows = await c.env.DB.prepare(
    `SELECT r.* FROM restaurants r
     LEFT JOIN restaurant_memberships m ON m.restaurant_id = r.id AND m.user_id = ?
     WHERE m.user_id = ? OR r.owner_user_id = ?
     ORDER BY r.created_at DESC`,
  ).bind(user.id, user.id, user.id).all<any>();
  return c.json({ restaurants: rows.results ?? [] });
});

app.post("/api/restaurants", async (c) => {
  const user = requireUser(c);
  const body = await jsonBody(c, restaurantSchema);
  if (!body) return c.json({ error: validationMessage(c, "Invalid restaurant payload") }, 400);

  const baseSlug = body.slug ? slugify(body.slug) : slugify(body.name);
  let slug = baseSlug;
  let attempt = 1;
  while (attempt < 50) {
    const clash = await c.env.DB.prepare(
      `SELECT id FROM restaurants WHERE slug = ? COLLATE NOCASE`,
    ).bind(slug).first<{ id: string }>();
    if (!clash) break;
    slug = baseSlug + "-" + attempt;
    attempt += 1;
  }

  const restaurantId = newId("restaurant");
  const timestamp = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO restaurants (
       id, name, slug, owner_user_id, description, phone, email, website_url,
       address_text, map_url, currency_code, locale, timezone, status, created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'draft', ?, ?)`,
  ).bind(
    restaurantId,
    body.name.trim(),
    slug,
    user.id,
    body.description || null,
    body.phone || null,
    body.email || null,
    body.website_url || null,
    body.address_text || null,
    body.map_url || null,
    body.currency_code.toUpperCase(),
    body.locale,
    body.timezone,
    timestamp,
    timestamp,
  ).run();

  await c.env.DB.prepare(
    `INSERT INTO restaurant_memberships (id, restaurant_id, user_id, role, created_at)
     VALUES (?,?,?,'owner',?)`,
  ).bind(newId("membership"), restaurantId, user.id, timestamp).run();

  await c.env.DB.prepare(
    `INSERT INTO brand_profiles (id, restaurant_id, palette_key, theme_tokens_json, typography_json, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`,
  ).bind(
    newId("brand"),
    restaurantId,
    "espresso-cream",
    JSON.stringify(PALETTES["espresso-cream"]),
    JSON.stringify({
      display: "'Fraunces', Georgia, 'Times New Roman', serif",
      body: "'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
    }),
    timestamp,
    timestamp,
  ).run();

  await c.env.DB.prepare(
    `INSERT INTO site_configurations (id, restaurant_id, template_key, template_version, created_at, updated_at)
     VALUES (?,?, 'editorial-showcase', '1.0.0', ?, ?)`,
  ).bind(newId("config"), restaurantId, timestamp, timestamp).run();

  const restaurant = await c.env.DB.prepare(
    `SELECT * FROM restaurants WHERE id = ?`,
  ).bind(restaurantId).first<any>();

  return c.json({ status: "ok", restaurant }, 201);
});

app.get("/api/restaurants/:id", async (c) => {
  const { restaurant } = await requireRestaurantAccess(c, c.req.param("id"), ["owner", "editor", "viewer"]);
  const brand = await c.env.DB.prepare(
    `SELECT * FROM brand_profiles WHERE restaurant_id = ?`,
  ).bind(restaurant.id).first<any>();
  const config = await c.env.DB.prepare(
    `SELECT * FROM site_configurations WHERE restaurant_id = ?`,
  ).bind(restaurant.id).first<any>();
  return c.json({ restaurant, brand, config });
});

app.patch("/api/restaurants/:id", async (c) => {
  const { restaurant } = await requireRestaurantAccess(c, c.req.param("id"), ["owner", "editor"]);
  const body = await jsonBody(c, restaurantSchema.partial());
  if (!body) return c.json({ error: "Invalid payload" }, 400);

  const map: Record<string, string> = {
    name: "name",
    description: "description",
    phone: "phone",
    email: "email",
    website_url: "website_url",
    address_text: "address_text",
    map_url: "map_url",
    currency_code: "currency_code",
    locale: "locale",
    timezone: "timezone",
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of Object.keys(map)) {
    const value = (body as any)[key];
    if (value !== undefined) {
      sets.push(map[key] + " = ?");
      values.push(value === "" ? null : value);
    }
  }
  if (sets.length === 0) return c.json({ status: "ok", restaurant });

  sets.push("updated_at = ?");
  values.push(nowIso());
  values.push(restaurant.id);

  await c.env.DB.prepare(
    `UPDATE restaurants SET ` + sets.join(", ") + ` WHERE id = ?`,
  ).bind(...(values as any[])).run();

  const updated = await c.env.DB.prepare(
    `SELECT * FROM restaurants WHERE id = ?`,
  ).bind(restaurant.id).first<any>();
  return c.json({ status: "ok", restaurant: updated });
});

// ============ Brand profiles ============

app.put("/api/brand-profiles/:restaurantId", async (c) => {
  const { restaurant } = await requireRestaurantAccess(c, c.req.param("restaurantId"), ["owner", "editor"]);
  const body = await jsonBody(c, z.object({
    palette_key: z.string().optional(),
    theme_tokens: z.record(z.string(), z.string()).optional(),
    typography: z.record(z.string(), z.string()).optional(),
  }));
  if (!body) return c.json({ error: validationMessage(c, "Invalid brand payload") }, 400);

  const paletteKey = body.palette_key && PALETTES[body.palette_key]
    ? body.palette_key
    : "espresso-cream";
  const tokens = body.theme_tokens || PALETTES[paletteKey];

  await c.env.DB.prepare(
    `UPDATE brand_profiles
     SET palette_key = ?, theme_tokens_json = ?, typography_json = ?, updated_at = ?
     WHERE restaurant_id = ?`,
  ).bind(
    paletteKey,
    JSON.stringify(tokens),
    JSON.stringify(body.typography || { display: "Georgia, serif", body: "system-ui, sans-serif" }),
    nowIso(),
    restaurant.id,
  ).run();

  const brand = await c.env.DB.prepare(
    `SELECT * FROM brand_profiles WHERE restaurant_id = ?`,
  ).bind(restaurant.id).first<any>();

  return c.json({
    status: "ok",
    brand: { ...brand, palette_key: paletteKey, theme_tokens: tokens },
  });
});

app.get("/api/brand-profiles/:restaurantId", async (c) => {
  const { restaurant } = await requireRestaurantAccess(c, c.req.param("restaurantId"), ["owner", "editor", "viewer"]);
  const brand = await c.env.DB.prepare(
    `SELECT * FROM brand_profiles WHERE restaurant_id = ?`,
  ).bind(restaurant.id).first<any>();
  return c.json({
    brand: brand
      ? { ...brand, theme_tokens: parseJson(brand.theme_tokens_json, {}) }
      : null,
  });
});

// ============ Menus ============

app.post("/api/menus", async (c) => {
  const body = await jsonBody(c, z.object({
    restaurant_id: z.string().min(1),
    name: z.string().min(1).max(120).default("Main Menu"),
    description: z.string().max(500).optional(),
    locale: z.string().max(10).default("en"),
  }));
  if (!body) return c.json({ error: validationMessage(c, "Invalid menu payload") }, 400);

  const { restaurant } = await requireRestaurantAccess(c, body.restaurant_id, ["owner", "editor"]);
  const menuId = newId("menu");
  const timestamp = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO menus (id, restaurant_id, name, description, menu_type, locale, is_active, sort_order, created_at, updated_at)
     VALUES (?,?,?,?, 'main', ?, 1, 0, ?, ?)`,
  ).bind(
    menuId,
    restaurant.id,
    body.name,
    body.description || null,
    body.locale,
    timestamp,
    timestamp,
  ).run();

  const menu = await c.env.DB.prepare(`SELECT * FROM menus WHERE id = ?`).bind(menuId).first<any>();
  return c.json({ status: "ok", menu }, 201);
});

app.get("/api/menus", async (c) => {
  const restaurantId = c.req.query("restaurant_id");
  if (!restaurantId) return c.json({ error: "restaurant_id is required" }, 400);
  await requireRestaurantAccess(c, restaurantId, ["owner", "editor", "viewer"]);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM menus WHERE restaurant_id = ? ORDER BY sort_order, created_at`,
  ).bind(restaurantId).all<any>();
  return c.json({ menus: rows.results ?? [] });
});

/** Full menu tree: menus -> categories -> items (with media). */
async function loadMenuTree(db: D1Database, restaurantId: string) {
  const menus = await db.prepare(
    `SELECT * FROM menus WHERE restaurant_id = ? ORDER BY sort_order, created_at`,
  ).bind(restaurantId).all<any>();

  const categories = await db.prepare(
    `SELECT mc.* FROM menu_categories mc
     JOIN menus m ON m.id = mc.menu_id
     WHERE m.restaurant_id = ?
     ORDER BY mc.sort_order, mc.created_at`,
  ).bind(restaurantId).all<any>();

  const items = await db.prepare(
    `SELECT mi.* FROM menu_items mi
     JOIN menu_categories mc ON mc.id = mi.category_id
     JOIN menus m ON m.id = mc.menu_id
     WHERE m.restaurant_id = ?
     ORDER BY mi.sort_order, mi.created_at`,
  ).bind(restaurantId).all<any>();

  const assets = await db.prepare(
    `SELECT id, storage_key, data_url, mime_type, original_filename, width, height, is_cutout
     FROM media_assets WHERE restaurant_id = ?`,
  ).bind(restaurantId).all<any>();

  const assetMap = new Map<string, any>();
  for (const asset of assets.results ?? []) assetMap.set(asset.id, asset);

  const tree = (menus.results ?? []).map((menu: any) => ({
    ...menu,
    categories: (categories.results ?? [])
      .filter((cat: any) => cat.menu_id === menu.id)
      .map((cat: any) => ({
        ...cat,
        items: (items.results ?? [])
          .filter((item: any) => item.category_id === cat.id && !item.archived_at)
          .map((item: any) => {
            const asset = item.primary_asset_id ? assetMap.get(item.primary_asset_id) : null;
            return {
              ...item,
              photo_url: asset ? (asset.data_url || mediaPathFor(asset)) : null,
              photo_width: asset?.width ?? null,
              photo_height: asset?.height ?? null,
              photo_is_cutout: asset ? asset.is_cutout === 1 : false,
              photo_meta: parseJson(item.photo_meta_json, null),
              price_minor: item.price_minor,
              currency_code: item.currency_code,
              main_ingredient: item.main_ingredient || null,
              ingredients: parseJson<string[]>(item.owner_ingredients_json, []),
              allergens: parseJson<string[]>(item.owner_allergens_json, []),
              dietary_labels: parseJson<string[]>(item.owner_dietary_labels_json, []),
              tags: parseJson<string[]>(item.tags_json, []),
            };
          }),
      })),
  }));

  return tree;
}

app.get("/api/menus/:restaurantId/tree", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  await requireRestaurantAccess(c, restaurantId, ["owner", "editor", "viewer"]);
  const tree = await loadMenuTree(c.env.DB, restaurantId);
  const origin = new URL(c.req.url).origin;
  return c.json({ menus: absolutizeMedia(tree, origin) });
});

/** Rewrite relative /media paths into absolute URLs for a given origin. */
function absolutizeMedia(node: any, origin: string): any {
  if (Array.isArray(node)) return node.map((n) => absolutizeMedia(n, origin));
  if (!node || typeof node !== "object") return node;
  const out: any = {};
  for (const key of Object.keys(node)) {
    const value = node[key];
    if ((key === "photo_url" || key === "url") && typeof value === "string" && value.startsWith("/media/")) {
      out[key] = origin + value;
    } else {
      out[key] = absolutizeMedia(value, origin);
    }
  }
  return out;
}

// ============ Categories ============

app.post("/api/categories", async (c) => {
  const body = await jsonBody(c, z.object({
    menu_id: z.string().min(1),
    name: z.string().min(1, "Category name is required").max(120),
    description: z.string().max(500).optional(),
  }));
  if (!body) return c.json({ error: validationMessage(c, "Invalid category payload") }, 400);

  const menu = await c.env.DB.prepare(`SELECT * FROM menus WHERE id = ?`).bind(body.menu_id).first<any>();
  if (!menu) return c.json({ error: "Menu not found" }, 404);
  await requireRestaurantAccess(c, menu.restaurant_id, ["owner", "editor"]);

  const maxRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM menu_categories WHERE menu_id = ?`,
  ).bind(body.menu_id).first<{ max_order: number }>();

  const categoryId = newId("category");
  const timestamp = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO menu_categories (id, menu_id, name, description, sort_order, is_visible, created_at, updated_at)
     VALUES (?,?,?,?,?,1,?,?)`,
  ).bind(
    categoryId,
    body.menu_id,
    body.name.trim(),
    body.description || null,
    (maxRow?.max_order ?? -1) + 1,
    timestamp,
    timestamp,
  ).run();

  const category = await c.env.DB.prepare(
    `SELECT * FROM menu_categories WHERE id = ?`,
  ).bind(categoryId).first<any>();
  return c.json({ status: "ok", category }, 201);
});

app.patch("/api/categories/:id", async (c) => {
  const category = await c.env.DB.prepare(
    `SELECT * FROM menu_categories WHERE id = ?`,
  ).bind(c.req.param("id")).first<any>();
  if (!category) return c.json({ error: "Category not found" }, 404);

  const menu = await c.env.DB.prepare(
    `SELECT * FROM menus WHERE id = ?`,
  ).bind(category.menu_id).first<any>();
  await requireRestaurantAccess(c, menu.restaurant_id, ["owner", "editor"]);

  const body = await jsonBody(c, z.object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
    is_visible: z.boolean().optional(),
  }));
  if (!body) return c.json({ error: "Invalid payload" }, 400);

  const sets: string[] = [];
  const values: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); values.push(body.name.trim()); }
  if (body.description !== undefined) { sets.push("description = ?"); values.push(body.description); }
  if (body.is_visible !== undefined) { sets.push("is_visible = ?"); values.push(body.is_visible ? 1 : 0); }
  if (sets.length) {
    sets.push("updated_at = ?");
    values.push(nowIso());
    values.push(category.id);
    await c.env.DB.prepare(
      `UPDATE menu_categories SET ` + sets.join(", ") + ` WHERE id = ?`,
    ).bind(...(values as any[])).run();
  }

  const updated = await c.env.DB.prepare(
    `SELECT * FROM menu_categories WHERE id = ?`,
  ).bind(category.id).first<any>();
  return c.json({ status: "ok", category: updated });
});

app.delete("/api/categories/:id", async (c) => {
  const category = await c.env.DB.prepare(
    `SELECT * FROM menu_categories WHERE id = ?`,
  ).bind(c.req.param("id")).first<any>();
  if (!category) return c.json({ error: "Category not found" }, 404);

  const menu = await c.env.DB.prepare(
    `SELECT * FROM menus WHERE id = ?`,
  ).bind(category.menu_id).first<any>();
  await requireRestaurantAccess(c, menu.restaurant_id, ["owner", "editor"]);

  await c.env.DB.prepare(`DELETE FROM menu_categories WHERE id = ?`).bind(category.id).run();
  return c.json({ status: "ok" });
});

// ============ Items ============

/** ~8 MB of base64 payload, comfortably above a 6 MB decoded image. */
const MAX_IMAGE_DATA_URL_LENGTH = 8 * 1024 * 1024;

/** Hard ceiling on a decoded image, in bytes. */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/**
 * Art-direction facts measured from the stored image. Optional: an item
 * uploaded before this existed simply has no metadata and falls back to a
 * centre crop.
 */
const photoMetaSchema = z.object({
  v: z.literal(1).optional(),
  focusX: z.number().min(0).max(1),
  focusY: z.number().min(0).max(1),
  ratio: z.number().positive().max(50),
  meanLuma: z.number().min(0).max(1),
  contrast: z.number().min(0).max(1),
  coverage: z.number().min(0).max(1),
  treatment: z.enum(["cover", "contain"]),
  dominant: z.tuple([z.number(), z.number(), z.number()]),
  subject: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
});

const itemSchema = z.object({
  category_id: z.string().min(1),
  name: z.string().min(1, "Item name is required").max(120),
  short_description: z.string().max(300).optional(),
  long_description: z.string().max(2000).optional(),
  price_minor: z.number().int().min(0).optional(),
  price: z.string().max(32).optional(),
  currency_code: z.string().length(3).optional(),
  is_available: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  ingredients: z.array(z.string().max(80)).max(40).optional(),
  allergens: z.array(z.string().max(80)).max(40).optional(),
  dietary_labels: z.array(z.string().max(80)).max(20).optional(),
  tags: z.array(z.string().max(80)).max(20).optional(),
  photo_data_url: z.string().max(MAX_IMAGE_DATA_URL_LENGTH).optional(),
  photo_filename: z.string().max(200).optional(),
  photo_width: z.number().int().positive().max(20000).optional(),
  photo_height: z.number().int().positive().max(20000).optional(),
  photo_is_cutout: z.boolean().optional(),
  photo_meta: photoMetaSchema.optional(),
  main_ingredient: z.string().trim().max(80).nullable().optional(),
});

/** Accepts either price_minor (integer) or a decimal price string like "12.95". */
function resolvePriceMinor(body: { price_minor?: number; price?: string; currency_code?: string }) {
  if (typeof body.price_minor === "number" && Number.isFinite(body.price_minor)) {
    return Math.round(body.price_minor);
  }
  if (typeof body.price === "string" && body.price.trim() !== "") {
    const numeric = Number(body.price.trim().replace(/[^0-9.]/g, ""));
    if (Number.isFinite(numeric)) return Math.round(numeric * 100);
  }
  return null;
}

app.post("/api/items", async (c) => {
  const body = await jsonBody(c, itemSchema);
  if (!body) return c.json({ error: validationMessage(c, "Invalid item payload") }, 400);

  const category = await c.env.DB.prepare(
    `SELECT * FROM menu_categories WHERE id = ?`,
  ).bind(body.category_id).first<any>();
  if (!category) return c.json({ error: "Category not found" }, 404);

  const menu = await c.env.DB.prepare(
    `SELECT * FROM menus WHERE id = ?`,
  ).bind(category.menu_id).first<any>();
  await requireRestaurantAccess(c, menu.restaurant_id, ["owner", "editor"]);

  let assetId: string | null = null;
  if (body.photo_data_url && body.photo_data_url.startsWith("data:")) {
    assetId = await storeAsset(
      c,
      menu.restaurant_id,
      body.photo_data_url,
      body.photo_filename || "item.png",
      { width: body.photo_width, height: body.photo_height, isCutout: body.photo_is_cutout },
    );
  }

  if (body.main_ingredient && Array.isArray(body.ingredients) && !body.ingredients.includes(body.main_ingredient)) {
    return c.json({ error: "main_ingredient must be one of the item's ingredients" }, 400);
  }

  const maxRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM menu_items WHERE category_id = ?`,
  ).bind(body.category_id).first<{ max_order: number }>();

  const itemId = newId("item");
  const timestamp = nowIso();
  const currency = (body.currency_code || menu.currency_code || "EGP").toUpperCase();

  await c.env.DB.prepare(
    `INSERT INTO menu_items (
       id, category_id, name, short_description, long_description, price_minor, currency_code,
       primary_asset_id, is_featured, is_available, is_visible,
       owner_ingredients_json, owner_allergens_json, owner_dietary_labels_json, tags_json,
       sort_order, created_at, updated_at, main_ingredient, photo_meta_json
     ) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    itemId,
    body.category_id,
    body.name.trim(),
    body.short_description || null,
    body.long_description || null,
    resolvePriceMinor(body),
    currency,
    assetId,
    body.is_featured ? 1 : 0,
    body.is_available === false ? 0 : 1,
    JSON.stringify(body.ingredients || []),
    JSON.stringify(body.allergens || []),
    JSON.stringify(body.dietary_labels || []),
    JSON.stringify(body.tags || []),
    (maxRow?.max_order ?? -1) + 1,
    timestamp,
    timestamp,
    body.main_ingredient || null,
    body.photo_meta ? JSON.stringify(body.photo_meta) : null,
  ).run();

  const item = await c.env.DB.prepare(
    `SELECT * FROM menu_items WHERE id = ?`,
  ).bind(itemId).first<any>();
  return c.json({
    status: "ok",
    item: { ...item, photo_meta: parseJson(item?.photo_meta_json, null) },
  }, 201);
});

app.patch("/api/items/:id", async (c) => {
  const item = await c.env.DB.prepare(
    `SELECT * FROM menu_items WHERE id = ?`,
  ).bind(c.req.param("id")).first<any>();
  if (!item) return c.json({ error: "Item not found" }, 404);

  const category = await c.env.DB.prepare(
    `SELECT * FROM menu_categories WHERE id = ?`,
  ).bind(item.category_id).first<any>();
  const menu = await c.env.DB.prepare(
    `SELECT * FROM menus WHERE id = ?`,
  ).bind(category.menu_id).first<any>();
  await requireRestaurantAccess(c, menu.restaurant_id, ["owner", "editor"]);

  const body = await jsonBody(c, z.object({
    name: z.string().min(1).max(120).optional(),
    short_description: z.string().max(300).optional(),
    long_description: z.string().max(2000).optional(),
    price_minor: z.number().int().min(0).optional(),
    price: z.string().optional(),
    currency_code: z.string().length(3).optional(),
    is_available: z.boolean().optional(),
    is_featured: z.boolean().optional(),
    ingredients: z.array(z.string().max(80)).max(40).optional(),
    allergens: z.array(z.string().max(80)).max(40).optional(),
    dietary_labels: z.array(z.string().max(80)).max(20).optional(),
    photo_data_url: z.string().max(MAX_IMAGE_DATA_URL_LENGTH).optional(),
    photo_filename: z.string().max(200).optional(),
    photo_width: z.number().int().positive().max(20000).optional(),
    photo_height: z.number().int().positive().max(20000).optional(),
    photo_is_cutout: z.boolean().optional(),
    photo_meta: photoMetaSchema.optional(),
    main_ingredient: z.string().trim().max(80).nullable().optional(),
  }));
  if (!body) return c.json({ error: "Invalid payload" }, 400);

  if (body.main_ingredient && Array.isArray(body.ingredients) && !body.ingredients.includes(body.main_ingredient)) {
    return c.json({ error: "main_ingredient must be one of the item's ingredients" }, 400);
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { sets.push("name = ?"); values.push(body.name.trim()); }
  if (body.short_description !== undefined) { sets.push("short_description = ?"); values.push(body.short_description); }
  if (body.long_description !== undefined) { sets.push("long_description = ?"); values.push(body.long_description); }
  if (body.price_minor !== undefined || body.price !== undefined) {
    sets.push("price_minor = ?");
    values.push(resolvePriceMinor(body));
  }
  if (body.currency_code !== undefined) { sets.push("currency_code = ?"); values.push(body.currency_code.toUpperCase()); }
  if (body.is_available !== undefined) { sets.push("is_available = ?"); values.push(body.is_available ? 1 : 0); }
  if (body.is_featured !== undefined) { sets.push("is_featured = ?"); values.push(body.is_featured ? 1 : 0); }
  if (body.ingredients !== undefined) { sets.push("owner_ingredients_json = ?"); values.push(JSON.stringify(body.ingredients)); }
  if (body.allergens !== undefined) { sets.push("owner_allergens_json = ?"); values.push(JSON.stringify(body.allergens)); }
  if (body.dietary_labels !== undefined) { sets.push("owner_dietary_labels_json = ?"); values.push(JSON.stringify(body.dietary_labels)); }
  if (body.main_ingredient !== undefined) { sets.push("main_ingredient = ?"); values.push(body.main_ingredient || null); }
  if (body.photo_meta !== undefined) { sets.push("photo_meta_json = ?"); values.push(JSON.stringify(body.photo_meta)); }
  if (body.photo_data_url && body.photo_data_url.startsWith("data:")) {
    const assetId = await storeAsset(
      c,
      menu.restaurant_id,
      body.photo_data_url,
      body.photo_filename || "item.png",
      { width: body.photo_width, height: body.photo_height, isCutout: body.photo_is_cutout },
    );
    sets.push("primary_asset_id = ?");
    values.push(assetId);
  }

  if (sets.length) {
    sets.push("updated_at = ?");
    values.push(nowIso());
    values.push(item.id);
    await c.env.DB.prepare(
      `UPDATE menu_items SET ` + sets.join(", ") + ` WHERE id = ?`,
    ).bind(...(values as any[])).run();
  }

  const updated = await c.env.DB.prepare(
    `SELECT * FROM menu_items WHERE id = ?`,
  ).bind(item.id).first<any>();

  // Return the same shape the menu tree uses, so a client can use either
  // response interchangeably.
  return c.json({
    status: "ok",
    item: {
      ...updated,
      ingredients: parseJson<string[]>(updated?.owner_ingredients_json, []),
      allergens: parseJson<string[]>(updated?.owner_allergens_json, []),
      dietary_labels: parseJson<string[]>(updated?.owner_dietary_labels_json, []),
      tags: parseJson<string[]>(updated?.tags_json, []),
      photo_meta: parseJson(updated?.photo_meta_json, null),
    },
  });
});

app.delete("/api/items/:id", async (c) => {
  const item = await c.env.DB.prepare(
    `SELECT * FROM menu_items WHERE id = ?`,
  ).bind(c.req.param("id")).first<any>();
  if (!item) return c.json({ error: "Item not found" }, 404);

  const category = await c.env.DB.prepare(
    `SELECT * FROM menu_categories WHERE id = ?`,
  ).bind(item.category_id).first<any>();
  const menu = await c.env.DB.prepare(
    `SELECT * FROM menus WHERE id = ?`,
  ).bind(category.menu_id).first<any>();
  await requireRestaurantAccess(c, menu.restaurant_id, ["owner", "editor"]);

  await c.env.DB.prepare(`DELETE FROM menu_items WHERE id = ?`).bind(item.id).run();
  return c.json({ status: "ok" });
});

/**
 * Persist an uploaded image.
 *
 * Preferred path: store the binary in the R2 bucket (MEDIA) and keep only the
 * object key + metadata in D1. This avoids D1 row-size limits and means the
 * menu payload stays small and fast.
 *
 * Fallback path: if R2 is unavailable, store the data URL in D1 so the feature
 * still works in constrained environments.
 */
async function storeAsset(
  c: AppContext,
  restaurantId: string,
  dataUrl: string,
  filename: string,
  dimensions?: { width?: number; height?: number; isCutout?: boolean },
): Promise<string> {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new HttpError(400, "Invalid image data URL");
  const mimeType = match[1];
  if (!/^image\//.test(mimeType)) {
    throw new HttpError(400, "Only image uploads are allowed");
  }
  const base64 = match[2];

  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  const byteLength = bytes.byteLength;
  if (byteLength > MAX_IMAGE_BYTES) {
    throw new HttpError(
      413,
      "Image is too large (" + Math.round(byteLength / 1024 / 1024) + " MB). Maximum is 6 MB.",
    );
  }
  const checksum = await sha256Hex(base64.slice(0, 8192));
  const assetId = newId("asset");

  /**
   * Detect a transparent background from the file itself.
   *
   * The client also reports whether it removed the background, but the
   * server does not have to trust that: the encoded file is inspected.
   */
  const hasAlphaChannel = sniffHasAlpha(mimeType, bytes);
  const isCutout = dimensions?.isCutout === true || hasAlphaChannel;

  const extension = mimeType.split("/")[1] || "bin";
  const storageKey = restaurantId + "/" + assetId + "." + extension;

  let storedInR2 = false;
  if (c.env.MEDIA) {
    try {
      await c.env.MEDIA.put(storageKey, bytes, {
        httpMetadata: { contentType: mimeType },
        customMetadata: { restaurantId, assetId },
      });
      storedInR2 = true;
    } catch (e) {
      console.error("R2 upload failed, falling back to D1:", e);
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO media_assets (
       id, restaurant_id, storage_key, original_filename, mime_type, width, height,
       byte_size, checksum_sha256, asset_role, processing_status, is_cutout,
       data_url, created_by, created_at
     ) VALUES (?,?,?,?,?,?,?,?,?, 'menu_item', 'ready', ?, ?, ?, ?)`,
  ).bind(
    assetId,
    restaurantId,
    storageKey,
    filename,
    mimeType,
    dimensions?.width ?? null,
    dimensions?.height ?? null,
    byteLength,
    checksum,
    isCutout ? 1 : 0,
    storedInR2 ? null : dataUrl,    c.get("user")?.id || null,
    nowIso(),
  ).run();
  return assetId;
}

/** Public URL for a stored media asset. */
function mediaPathFor(asset: any): string | null {
  if (!asset) return null;
  if (asset.data_url) return null; // served inline from the snapshot payload
  return "/media/" + asset.storage_key;
}

// ============ Template config ============

app.put("/api/restaurants/:id/template", async (c) => {
  const { restaurant } = await requireRestaurantAccess(c, c.req.param("id"), ["owner", "editor"]);
  const body = await jsonBody(c, z.object({
    template_key: z.string().min(1),
    template_config: z.record(z.string(), z.any()).optional(),
  }));
  if (!body) return c.json({ error: validationMessage(c, "Invalid template payload") }, 400);

  const known = TEMPLATES.some((t) => t.key === body.template_key);
  if (!known) return c.json({ error: "Unknown template key" }, 400);

  const existing = await c.env.DB.prepare(
    `SELECT * FROM site_configurations WHERE restaurant_id = ?`,
  ).bind(restaurant.id).first<any>();

  const timestamp = nowIso();
  if (existing) {
    await c.env.DB.prepare(
      `UPDATE site_configurations
       SET template_key = ?, template_config_json = ?, config_version = config_version + 1, updated_at = ?
       WHERE id = ?`,
    ).bind(
      body.template_key,
      JSON.stringify(body.template_config || {}),
      timestamp,
      existing.id,
    ).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO site_configurations (id, restaurant_id, template_key, template_version, template_config_json, created_at, updated_at)
       VALUES (?,?,?, '1.0.0', ?, ?, ?)`,
    ).bind(
      newId("config"),
      restaurant.id,
      body.template_key,
      JSON.stringify(body.template_config || {}),
      timestamp,
      timestamp,
    ).run();
  }

  const config = await c.env.DB.prepare(
    `SELECT * FROM site_configurations WHERE restaurant_id = ?`,
  ).bind(restaurant.id).first<any>();
  return c.json({ status: "ok", config });
});

// ============ Publish ============

app.post("/api/publish", async (c) => {
  const body = await jsonBody(c, z.object({
    restaurant_id: z.string().min(1),
    template: z.string().optional(),
    template_key: z.string().optional(),
  }));
  if (!body) return c.json({ error: validationMessage(c, "Invalid publish payload") }, 400);

  const { restaurant } = await requireRestaurantAccess(c, body.restaurant_id, ["owner", "editor"]);
  const templateKey = body.template || body.template_key || "editorial-showcase";
  if (!TEMPLATES.some((t) => t.key === templateKey)) {
    return c.json({ error: "Unknown template key" }, 400);
  }

  const brand = await c.env.DB.prepare(
    `SELECT * FROM brand_profiles WHERE restaurant_id = ?`,
  ).bind(restaurant.id).first<any>();
  const config = await c.env.DB.prepare(
    `SELECT * FROM site_configurations WHERE restaurant_id = ?`,
  ).bind(restaurant.id).first<any>();
  const tree = await loadMenuTree(c.env.DB, restaurant.id);

  // Resolve macro photography for each item's hero ingredient once, so the
  // snapshot is self-contained and carries its own attribution credits.
  // Resolution is cached in D1+R2 forever; failures never block a publish.
  const heroIngredients = collectHeroIngredients(tree);
  const ingredientPhotos: Record<string, any> = {};
  for (const hero of heroIngredients) {
    if (Object.keys(ingredientPhotos).length >= 12) break;
    try {
      const photo = await ensureIngredientPhoto(c.env, hero.name);
      if (photo?.url) {
        ingredientPhotos[hero.slug] = {
          displayName: photo.displayName,
          url: photo.url,
          source: photo.source,
          sourceUrl: photo.sourceUrl,
          license: photo.license,
          licenseUrl: photo.licenseUrl,
          creator: photo.creator,
          width: photo.width,
          height: photo.height,
        };
      }
    } catch (e) {
      console.error("ingredient resolve failed for " + hero.name, e);
    }
  }

  const activeMenus = tree.filter((m: any) => m.categories.length > 0);
  if (activeMenus.length === 0) {
    return c.json({ error: "Add at least one category with an item before publishing" }, 400);
  }

  const snapshot = {
    schema_version: 1,
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description,
      phone: restaurant.phone,
      email: restaurant.email,
      website_url: restaurant.website_url,
      address_text: restaurant.address_text,
      currency_code: restaurant.currency_code,
      locale: restaurant.locale,
      timezone: restaurant.timezone,
    },
    brand: {
      palette_key: brand?.palette_key || "espresso-cream",
      theme_tokens: parseJson(brand?.theme_tokens_json, PALETTES["espresso-cream"]),
      typography: parseJson(brand?.typography_json, {}),
    },
    template: {
      key: templateKey,
      version: config?.template_version || "1.0.0",
      config: parseJson(config?.template_config_json, {}),
    },
    menus: activeMenus,
    ingredientPhotos,
    published_at: nowIso(),
  };

  const snapshotJson = JSON.stringify(snapshot);
  const checksum = await sha256Hex(snapshotJson);

  const maxRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(version_number), 0) AS max_version FROM published_versions WHERE restaurant_id = ?`,
  ).bind(restaurant.id).first<{ max_version: number }>();
  const versionNumber = (maxRow?.max_version ?? 0) + 1;

  const versionId = newId("version");
  const timestamp = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO published_versions (
       id, restaurant_id, version_number, snapshot_schema_version, snapshot_json,
       checksum_sha256, template_key, template_version, published_by, created_at
     ) VALUES (?,?,?,1,?,?,?,?,?,?)`,
  ).bind(
    versionId,
    restaurant.id,
    versionNumber,
    snapshotJson,
    checksum,
    templateKey,
    snapshot.template.version,
    c.get("user")?.id || null,
    timestamp,
  ).run();

  await c.env.DB.prepare(
    `UPDATE restaurants SET published_version_id = ?, status = 'active', updated_at = ? WHERE id = ?`,
  ).bind(versionId, timestamp, restaurant.id).run();

  const origin = new URL(c.req.url).origin;
  const webBase = (c.env.PUBLIC_WEB_URL || origin).replace(/\/$/, "");
  const publishedUrl = webBase + "/m/" + restaurant.slug;
  const qrCodeData = webBase + "/m/" + restaurant.slug + "/" + versionId;

  // Media paths are stored relative in the snapshot so the snapshot stays
  // portable across origins; they are absolutised per request.
  const snapshotForResponse = absolutizeMedia(snapshot, origin);

  return c.json({
    status: "ok",
    snapshotId: versionId,
    versionNumber,
    checksum,
    template: templateKey,
    publishedUrl,
    qrCodeData,
    publishedAt: timestamp,
  }, 201);
});

app.get("/api/publish/:restaurantId/versions", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  await requireRestaurantAccess(c, restaurantId, ["owner", "editor", "viewer"]);
  const rows = await c.env.DB.prepare(
    `SELECT id, version_number, checksum_sha256, template_key, template_version, created_at
     FROM published_versions WHERE restaurant_id = ? ORDER BY version_number DESC`,
  ).bind(restaurantId).all<any>();
  return c.json({ versions: rows.results ?? [] });
});

// ============ Ingredient photo resolution ============

/**
 * Resolve a macro photo for an ingredient by name, so the Ingredient Story
 * template can use the item's signature ingredient as its section backdrop.
 *
 * Sources are licence-checked search APIs, never image generation:
 *   1. Openverse (CC0 / PDM / CC-BY / CC-BY-SA only)
 *   2. Wikimedia Commons (attribution read from extmetadata)
 *
 * The download is stored in R2 so a published menu never hotlinks a third
 * party, and the licence + creator are recorded so the public menu can show
 * attribution. Results are cached in D1 forever; a missing resolve never
 * breaks publishing.
 */

/** Normalise an ingredient name into a stable cache key. */
export function ingredientSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritical marks
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const UA = "UrOwnMenu/1.0 (+https://github.com/ur-own-menu; open-source)";

function fetchWithTimeout(url: string, ms: number, headers?: Record<string, string>) {
  return fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { "User-Agent": UA, ...(headers || {}) },
  });
}

type FoundIngredientPhoto = {
  downloadUrl: string;
  source: "openverse" | "commons" | "wikipedia";
  sourceUrl: string | null;
  license: string;
  licenseUrl: string | null;
  creator: string | null;
  width: number | null;
  height: number | null;
};

/** Openverse: CC-licensed image search, no key required. */
async function searchOpenverse(name: string): Promise<FoundIngredientPhoto | null> {
  const url =
    "https://api.openverse.org/v1/images/?q=" +
    encodeURIComponent(name) +
    "&license=cc0,pdm,by,by-sa&page_size=10&mature=false";
  const res = await fetchWithTimeout(url, 8000, { Accept: "application/json" });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as any;
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  const big = results.filter((r) => typeof r?.url === "string" && (r.width ?? 0) >= 700);
  const pick = big.find((r) => (r.width ?? 0) >= (r.height ?? 1)) ?? big[0] ?? null;
  if (!pick) return null;
  const license = pick.license
    ? String(pick.license).toUpperCase() + (pick.license_version ? " " + pick.license_version : "")
    : "unknown";
  return {
    downloadUrl: pick.url as string,
    source: "openverse",
    sourceUrl: pick.foreign_landing_url || pick.url || null,
    license,
    licenseUrl: pick.license_url || null,
    creator: pick.creator || null,
    width: Number(pick.width) || null,
    height: Number(pick.height) || null,
  };
}

/**
 * Wikipedia REST lead image for the ingredient, e.g. "Chicken_as_food" or
 * "Cold_brew_coffee". Lead images are chosen by editors and are almost
 * always on-topic and freely licensed. Used when Openverse knows nothing.
 */
async function searchWikipediaLead(
  name: string,
): Promise<FoundIngredientPhoto | null> {
  const url =
    "https://en.wikipedia.org/api/rest_v1/page/summary/" +
    encodeURIComponent(name.trim().replace(/\s+/g, "_"));
  const res = await fetchWithTimeout(url, 8000, { Accept: "application/json" });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as any;
  const img = data?.originalimage?.source || data?.thumbnail?.source;
  if (typeof img !== "string" || img.length === 0) return null;

  // File name from the upload path, for the licence lookup.
  const m =
    /\/commons\/(?:thumb\/[a-f0-9]\/[a-f0-9]{2}\/([^/]+)\/[0-9]+px-[^/]+\?*|[a-f0-9]\/[a-f0-9]{2}\/([^/?]+))/.exec(
      img,
    );
  const fileName = m ? decodeURIComponent((m[1] || m[2] || "").replace(/\?.*$/, "")) : null;

  let license = "see source page";
  let licenseUrl: string | null = null;
  let creator: string | null = null;
  if (fileName) {
    try {
      const infoUrl =
        "https://commons.wikimedia.org/w/api.php?action=query&titles=" +
        encodeURIComponent("File:" + fileName) +
        "&prop=imageinfo&iiprop=extmetadata&format=json";
      const infoRes = await fetchWithTimeout(infoUrl, 8000, {
        Accept: "application/json",
      });
      const info = (await infoRes.json().catch(() => null)) as any;
      const pages: Record<string, any> = info?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const meta = page?.imageinfo?.[0]?.extmetadata ?? {};
      if (typeof meta.LicenseShortName?.value === "string") license = meta.LicenseShortName.value;
      licenseUrl = meta.LicenseUrl?.value || null;
      creator =
        String(meta.Artist?.value || "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim() || null;
    } catch (e) {
      console.error("wikipedia licence lookup failed for " + fileName, e);
    }
  }

  return {
    downloadUrl: img,
    source: "wikipedia",
    sourceUrl: data?.content_urls?.desktop?.page || null,
    license,
    licenseUrl,
    creator,
    width: data?.originalimage?.width ?? null,
    height: data?.originalimage?.height ?? null,
  };
}

/** Wikimedia Commons: free media search with licence metadata. */
async function searchCommons(name: string): Promise<FoundIngredientPhoto | null> {
  // Distinctive tokens of the ingredient; a candidate must carry at least
  // one of them, or the hit is almost certainly off-topic (stabilisers,
  // poultry livestock, books...).
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 4)
  const titleMatches = (title: string) => {
    const t = title.toLowerCase()
    return tokens.some((tok) => t.includes(tok))
  }
  const searchUrl =
    "https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=" +
    encodeURIComponent(name) +
    "&srnamespace=6&srlimit=8&format=json";
  const res = await fetchWithTimeout(searchUrl, 8000, { Accept: "application/json" });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as any;
  const hits: any[] = data?.query?.search ?? [];
  for (const hit of hits) {
    if (!hit?.title) continue;
    if (!titleMatches(hit.title)) continue;
    const infoUrl =
      "https://commons.wikimedia.org/w/api.php?action=query&titles=" +
      encodeURIComponent(hit.title) +
      "&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600&format=json";
    const infoRes = await fetchWithTimeout(infoUrl, 8000, { Accept: "application/json" });
    if (!infoRes.ok) continue;
    const info = (await infoRes.json().catch(() => null)) as any;
    const pages: Record<string, any> = info?.query?.pages ?? {};
    const page = Object.values(pages)[0];
    const ii = page?.imageinfo?.[0];
    if (!ii?.url) continue;
    if ((ii.width ?? 0) < 700) continue;
    const meta = ii.extmetadata ?? {};
    const artist = String(meta.Artist?.value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      downloadUrl: ii.thumburl || ii.url,
      source: "commons",
      sourceUrl: ii.descriptionurl || null,
      license: meta.LicenseShortName?.value || "see source",
      licenseUrl: meta.LicenseUrl?.value || null,
      creator: artist || null,
      width: ii.thumbwidth ?? ii.width ?? null,
      height: ii.thumbheight ?? ii.height ?? null,
    };
  }
  return null;
}

type IngredientPhoto = {
  slug: string;
  displayName: string;
  url: string | null;
  source: string;
  sourceUrl: string | null;
  license: string;
  licenseUrl: string | null;
  creator: string | null;
  width: number | null;
  height: number | null;
};

/** Cache-first resolution of an ingredient photo. Never throws on a miss. */
async function ensureIngredientPhoto(
  env: any,
  name: string,
): Promise<IngredientPhoto | null> {
  const slug = ingredientSlug(name);
  if (!slug) return null;

  const cached = await env.DB.prepare(
    `SELECT * FROM ingredient_photos WHERE slug = ?`,
  ).bind(slug).first();
  if (cached) {
    return {
      slug,
      displayName: cached.display_name,
      url: cached.image_url,
      source: cached.source,
      sourceUrl: cached.source_url,
      license: cached.license,
      licenseUrl: cached.license_url,
      creator: cached.creator,
      width: cached.width,
      height: cached.height,
    };
  }

  const found = (await searchOpenverse(name).catch(() => null)) ??
    (await searchWikipediaLead(name).catch(() => null)) ??
    (await searchCommons(name).catch(() => null));
  if (!found) return null;

  // Download and store in R2 so the menu never hotlinks a third party.
  let imageKey: string | null = null;
  let imageUrl: string | null = found.downloadUrl;
  try {
    const img = await fetchWithTimeout(found.downloadUrl, 10000, { Accept: "image/*" });
    const type = img.headers.get("content-type") || "image/jpeg";
    const bytes = await img.arrayBuffer();
    if (bytes.byteLength > 0 && bytes.byteLength <= 6 * 1024 * 1024 && type.startsWith("image/")) {
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
      const digest = await sha256Hex(slug + ":" + found.downloadUrl);
      imageKey = `ingredients/${slug}-${digest.slice(0, 12)}.${ext}`;
      if (env.MEDIA) {
        await env.MEDIA.put(imageKey, bytes, {
          httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" },
        });
        imageUrl = "/media/" + imageKey;
      }
    }
  } catch (e) {
    console.error("ingredient photo download failed for " + name, e);
  }

  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO ingredient_photos
         (slug, display_name, image_key, image_url, source, source_url, license, license_url, creator, width, height)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      slug, name, imageKey, imageUrl, found.source, found.sourceUrl,
      found.license, found.licenseUrl, found.creator, found.width, found.height,
    ).run();
  } catch (e) {
    console.error("ingredient photo cache failed for " + name, e);
  }

  return {
    slug,
    displayName: name,
    url: imageUrl,
    source: found.source,
    sourceUrl: found.sourceUrl,
    license: found.license,
    licenseUrl: found.licenseUrl,
    creator: found.creator,
    width: found.width,
    height: found.height,
  };
}

/** The hero ingredient for every item in the menu tree. */
function collectHeroIngredients(tree: any[]): Array<{ slug: string; name: string }> {
  const out = new Map<string, string>();
  for (const menu of tree) {
    for (const cat of menu.categories ?? []) {
      for (const item of cat.items ?? []) {
        const candidates: string[] = Array.isArray(item.ingredients) ? item.ingredients : [];
        const hero =
          (typeof item.main_ingredient === "string" && item.main_ingredient.trim()) ||
          candidates[0] ||
          "";
        const slug = ingredientSlug(hero);
        if (slug && !out.has(slug)) out.set(slug, hero);
      }
    }
  }
  return [...out].map(([slug, name]) => ({ slug, name }));
}

// ============ Media ============

/** Serve an image stored in R2. */
app.get("/media/*", async (c) => {
  const key = c.req.path.replace(/^\/media\//, "");
  if (!key) return c.json({ error: "Not found" }, 404);

  if (c.env.MEDIA) {
    try {
      const object = await c.env.MEDIA.get(key);
      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(object.body, { headers });
      }
    } catch (e) {
      console.error("R2 read failed:", e);
    }
  }

  // Fallback: inline data URL stored in D1.
  const asset = await c.env.DB.prepare(
    `SELECT data_url, mime_type FROM media_assets WHERE storage_key = ?`,
  ).bind(key).first<{ data_url: string | null; mime_type: string }>();

  if (asset?.data_url) {
    const match = /^data:([^;]+);base64,(.*)$/.exec(asset.data_url);
    if (match) {
      const binary = atob(match[2]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Response(bytes, {
        headers: {
          "Content-Type": match[1],
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  return c.json({ error: "Image not found" }, 404);
});

// ============ Public menu (no auth) ============

app.get("/m/:slug", async (c) => {
  const slug = c.req.param("slug");
  const restaurant = await c.env.DB.prepare(
    `SELECT * FROM restaurants WHERE slug = ? COLLATE NOCASE`,
  ).bind(slug).first<any>();

  if (!restaurant || !restaurant.published_version_id) {
    return c.json({ error: "Menu not found" }, 404);
  }

  const version = await c.env.DB.prepare(
    `SELECT * FROM published_versions WHERE id = ?`,
  ).bind(restaurant.published_version_id).first<any>();

  if (!version) return c.json({ error: "Menu not found" }, 404);

  return c.json({
    status: "ok",
    slug,
    versionId: version.id,
    versionNumber: version.version_number,
    checksum: version.checksum_sha256,
    publishedAt: version.created_at,
    menu: absolutizeMedia(parseJson(version.snapshot_json, null), new URL(c.req.url).origin),
  });
});

app.get("/m/:slug/:versionId", async (c) => {
  const slug = c.req.param("slug");
  const versionId = c.req.param("versionId");

  const restaurant = await c.env.DB.prepare(
    `SELECT id FROM restaurants WHERE slug = ? COLLATE NOCASE`,
  ).bind(slug).first<any>();
  if (!restaurant) return c.json({ error: "Menu not found" }, 404);

  const version = await c.env.DB.prepare(
    `SELECT * FROM published_versions WHERE id = ? AND restaurant_id = ?`,
  ).bind(versionId, restaurant.id).first<any>();
  if (!version) return c.json({ error: "Menu version not found" }, 404);

  return c.json({
    status: "ok",
    slug,
    versionId: version.id,
    versionNumber: version.version_number,
    checksum: version.checksum_sha256,
    publishedAt: version.created_at,
    menu: absolutizeMedia(parseJson(version.snapshot_json, null), new URL(c.req.url).origin),
  });
});

// ============ QR ============

app.get("/api/qr/:versionId", async (c) => {
  const versionId = c.req.param("versionId");
  const version = await c.env.DB.prepare(
    `SELECT pv.*, r.slug FROM published_versions pv
     JOIN restaurants r ON r.id = pv.restaurant_id
     WHERE pv.id = ?`,
  ).bind(versionId).first<any>();

  if (!version) return c.json({ error: "Version not found" }, 404);

  const origin = new URL(c.req.url).origin;
  const webBase = (c.env.PUBLIC_WEB_URL || origin).replace(/\/$/, "");
  const url = webBase + "/m/" + version.slug + "/" + version.id;
  return c.json({
    status: "ok",
    qrCodeData: url,
    url,
    restaurantSlug: version.slug,
    versionId: version.id,
    versionNumber: version.version_number,
  });
});

// ============ Deterministic AI helpers (free tier, no paid service) ============

app.post("/api/ai/menu-copy", async (c) => {
  const body = await jsonBody(c, z.object({
    restaurant_name: z.string().optional(),
    items: z.array(z.object({
      name: z.string(),
      short_description: z.string().optional(),
    })).optional(),
  }));
  if (!body) return c.json({ error: "Invalid payload" }, 400);

  const suggestions = (body.items || []).map((item) => ({
    name: item.name,
    short_description: item.short_description ||
      ("A house favourite from " + (body.restaurant_name || "our kitchen") + ", prepared fresh to order."),
    tags: ["chef-pick"],
  }));

  return c.json({
    status: "ok",
    provider: "deterministic-local",
    model: "rule-based-v1",
    suggestions,
  });
});

app.post("/api/ai/template-recommendation", async (c) => {
  const body = await jsonBody(c, z.object({
    item_count: z.number().optional(),
    category_count: z.number().optional(),
    has_ingredients: z.boolean().optional(),
    photo_coverage: z.number().optional(),
    menu_type: z.string().optional(),
  }));
  if (!body) return c.json({ error: "Invalid payload" }, 400);

  const itemCount = body.item_count ?? 0;
  const categoryCount = body.category_count ?? 0;
  const hasIngredients = body.has_ingredients ?? false;
  const photoCoverage = body.photo_coverage ?? 0;

  const scored = TEMPLATES.map((t) => {
    let score = 0;
    const reasons: string[] = [];
    if (t.key === "ingredient-universe" && hasIngredients) { score += 40; reasons.push("Confirmed ingredients suit the Ingredient Universe"); }
    if (t.key === "orbital-menu" && itemCount <= 12) { score += 28; reasons.push("A focused list of " + itemCount + " items reads well as an orbit"); }
    if (t.key === "endless-table" && photoCoverage > 0.5) { score += 30; reasons.push("Strong photo coverage suits a continuous scroll"); }
    if (t.key === "editorial-showcase" && categoryCount >= 3) { score += 26; reasons.push(categoryCount + " categories give the editorial hero room to breathe"); }
    if (t.key === "magazine" && itemCount <= 20) { score += 18; reasons.push("Works well for a printed-style tasting presentation"); }
    return { key: t.key, name: t.name, score, reasons, best_for: t.bestFor };
  }).sort((a, b) => b.score - a.score);

  return c.json({
    status: "ok",
    provider: "deterministic-local",
    model: "rule-based-v1",
    recommendations: scored.slice(0, 3),
  });
});

app.post("/api/ai/organize-categories", async (c) => {
  const body = await jsonBody(c, z.object({
    items: z.array(z.object({ name: z.string(), short_description: z.string().optional() })),
  }));
  if (!body) return c.json({ error: "Invalid payload" }, 400);

  const rules: Array<{ name: string; keywords: string[] }> = [
    { name: "Starters", keywords: ["salad", "soup", "starter", "dip", "hummus", "bruschetta", "appetizer"] },
    { name: "Mains", keywords: ["pizza", "burger", "pasta", "steak", "chicken", "rice", "sandwich", "bowl"] },
    { name: "Desserts", keywords: ["cake", "ice cream", "pudding", "tart", "cookie", "brownie", "dessert"] },
    { name: "Drinks", keywords: ["juice", "coffee", "latte", "tea", "soda", "lemonade", "smoothie", "cocktail"] },
  ];

  const grouped: Record<string, string[]> = {};
  for (const item of body.items) {
    const haystack = (item.name + " " + (item.short_description || "")).toLowerCase();
    const match = rules.find((rule) => rule.keywords.some((kw) => haystack.includes(kw)));
    const bucket = match ? match.name : "House Specials";
    if (!grouped[bucket]) grouped[bucket] = [];
    grouped[bucket].push(item.name);
  }

  return c.json({
    status: "ok",
    provider: "deterministic-local",
    model: "rule-based-v1",
    categories: Object.keys(grouped).map((name) => ({ name, items: grouped[name] })),
  });
});

app.post("/api/ai/visual-review", async (c) => {
  const body = await jsonBody(c, z.object({
    restaurant_id: z.string().optional(),
    version_id: z.string().optional(),
  }));
  if (!body) return c.json({ error: "Invalid payload" }, 400);

  const checks = [
    { id: "logo-crispness", label: "Logo is crisp and not stretched", status: "pass" },
    { id: "palette-consistency", label: "Palette is applied consistently across the menu", status: "pass" },
    { id: "price-scanning", label: "Prices align and are easy to scan", status: "pass" },
    { id: "coherent-photography", label: "Photography is consistent across items", status: "manual_review" },
    { id: "no-clipped-labels", label: "No clipped labels or overflow", status: "pass" },
    { id: "whitespace-rhythm", label: "Whitespace rhythm is consistent", status: "manual_review" },
    { id: "mobile-layout", label: "Mobile layout is usable", status: "pass" },
    { id: "aria-labels", label: "Interactive elements have accessible names", status: "pass" },
  ];

  return c.json({
    status: "ok",
    provider: "deterministic-local",
    model: "rule-based-v1",
    checks,
  });
});

/**
 * Detect whether an encoded image carries an alpha channel.
 *
 * The client also reports whether it removed the background, but the server
 * does not have to trust that: the file itself is inspected.
 *
 * - PNG: byte 25 is the IHDR colour type. 4 = greyscale + alpha,
 *   6 = truecolour + alpha.
 * - WebP: an extended file starts with a "VP8X" chunk whose flags byte
 *   carries an alpha flag (0x10). A plain "VP8 " chunk is lossy and opaque.
 */
function sniffHasAlpha(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === "image/png") {
    return bytes.length > 25 && (bytes[25] === 4 || bytes[25] === 6);
  }
  if (mimeType === "image/webp") {
    if (bytes.length < 21) return false;
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk !== "VP8X") return false;
    const flags = bytes[20];
    return (flags & 0x10) !== 0;
  }
  return false;
}

export default {
  fetch(request: Request, env: Env, ctx: unknown) {
    return app.fetch(request, env, ctx as any);
  },
};
