import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * UrOwnMenu schema for Cloudflare D1 (SQLite).
 *
 * This mirrors migrations/0001_init.sql and migrations/0002_media_dimensions.sql
 * exactly. The API talks to D1 through prepared statements, so this file is the
 * typed reference for the same tables.
 */

// ============ Identity ============

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: text("email_verified"),
  image: text("image"),
  password: text("password"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    userIdx: uniqueIndex("idx_session_user").on(table.userId),
  }),
);

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: text("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ============ Restaurant core ============

export const restaurants = sqliteTable("restaurants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  description: text("description"),
  phone: text("phone"),
  email: text("email"),
  websiteUrl: text("website_url"),
  addressText: text("address_text"),
  mapUrl: text("map_url"),
  currencyCode: text("currency_code").notNull().default("EGP"),
  locale: text("locale").notNull().default("en"),
  timezone: text("timezone").notNull().default("Africa/Cairo"),
  status: text("status").notNull().default("draft"),
  publishedVersionId: text("published_version_id"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const restaurantMemberships = sqliteTable(
  "restaurant_memberships",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    uniq: uniqueIndex("restaurant_memberships_restaurant_user_unique").on(
      table.restaurantId,
      table.userId,
    ),
    userIdx: uniqueIndex("idx_memberships_user").on(table.userId),
  }),
);

export const brandProfiles = sqliteTable("brand_profiles", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id")
    .notNull()
    .unique()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  paletteKey: text("palette_key"),
  themeTokensJson: text("theme_tokens_json").notNull().default("{}"),
  typographyJson: text("typography_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ============ Menu authoring ============

export const menus = sqliteTable(
  "menus",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    menuType: text("menu_type").notNull().default("main"),
    locale: text("locale").notNull().default("en"),
    isActive: integer("is_active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    restaurantIdx: uniqueIndex("idx_menus_restaurant").on(table.restaurantId, table.sortOrder),
  }),
);

export const menuCategories = sqliteTable(
  "menu_categories",
  {
    id: text("id").primaryKey(),
    menuId: text("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isVisible: integer("is_visible").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    menuIdx: uniqueIndex("idx_categories_menu").on(table.menuId, table.sortOrder),
  }),
);

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull().unique(),
    originalFilename: text("original_filename"),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    byteSize: integer("byte_size").notNull().default(0),
    checksumSha256: text("checksum_sha256").notNull().default(""),
    assetRole: text("asset_role").notNull().default("menu_item"),
    processingStatus: text("processing_status").notNull().default("ready"),
    dataUrl: text("data_url"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    restaurantIdx: uniqueIndex("idx_assets_restaurant").on(table.restaurantId, table.createdAt),
  }),
);

export const menuItems = sqliteTable(
  "menu_items",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    shortDescription: text("short_description"),
    longDescription: text("long_description"),
    priceMinor: integer("price_minor"),
    currencyCode: text("currency_code").notNull().default("EGP"),
    primaryAssetId: text("primary_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    isFeatured: integer("is_featured").notNull().default(0),
    isAvailable: integer("is_available").notNull().default(1),
    isVisible: integer("is_visible").notNull().default(1),
    ownerIngredientsJson: text("owner_ingredients_json").notNull().default("[]"),
    ownerAllergensJson: text("owner_allergens_json").notNull().default("[]"),
    ownerDietaryLabelsJson: text("owner_dietary_labels_json").notNull().default("[]"),
    tagsJson: text("tags_json").notNull().default("[]"),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    categoryIdx: uniqueIndex("idx_items_category").on(table.categoryId, table.sortOrder),
  }),
);

// ============ Site config + publishing ============

export const siteConfigurations = sqliteTable("site_configurations", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  templateKey: text("template_key").notNull().default("editorial-showcase"),
  templateVersion: text("template_version").notNull().default("1.0.0"),
  themeTokensJson: text("theme_tokens_json").notNull().default("{}"),
  templateConfigJson: text("template_config_json").notNull().default("{}"),
  enabledSectionsJson: text("enabled_sections_json").notNull().default("[]"),
  configVersion: integer("config_version").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const publishedVersions = sqliteTable(
  "published_versions",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    snapshotSchemaVersion: integer("snapshot_schema_version").notNull().default(1),
    snapshotJson: text("snapshot_json").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    templateKey: text("template_key").notNull(),
    templateVersion: text("template_version").notNull().default("1.0.0"),
    publishedBy: text("published_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    uniq: uniqueIndex("published_versions_restaurant_version_unique").on(
      table.restaurantId,
      table.versionNumber,
    ),
    restaurantIdx: uniqueIndex("idx_published_restaurant").on(table.restaurantId, table.versionNumber),
  }),
);
