# Product and Software Requirements Specification

**Product:** UrOwnMenu. **Version:** 1.0 baseline.

## 1. Vision and target users

UrOwnMenu lets a non-technical restaurant owner turn menu content and photos into a custom-feeling digital menu without hiring a web designer. Target customers include restaurants, cafés, coffee shops, juice and smoothie brands, bakeries, dessert shops, pizza/burger venues, fine dining, chef-led restaurants, and food trucks. Templates must suit the food and brand; not every client wants the same visual style.

## 2. Roles

- Owner: full control of restaurant, team, menu, brand, templates, and publishing.
- Editor: manages menu, media, story, and design; no ownership controls.
- Viewer: read-only studio access.
- Public visitor: reads published menu only.
- Platform admin: moderation and operations.

## 3. Main owner journeys

### Restaurant setup
Sign up, create restaurant profile (name, slug, description, address, phone, email, website, social links, hours, timezone, locale, currency), upload restaurant logo and optional cover/gallery photos, select or customize a brand palette, create one or more menus such as Main, Breakfast, Drinks, Seasonal.

### Menu item creation/import
Required item data: name, description, clear photo, category, price/currency (owner may hide prices). Optional: long description, variants/sizes, owner-supplied ingredients, owner-supplied allergens, owner-supplied dietary labels, tags, availability, featured flag, sort order. Nutrition/calories only when supplied and verified by owner. Manual entry first; CSV import with column mapping, preview, duplicate detection, validation and error report next. Owner can reorder, duplicate, hide, archive, and edit items/categories.

### Template selection
Ask menu type, item/category count, preferred mood (editorial, playful, minimal, immersive, luxury, rustic, modern), whether story section is wanted, and preferred orientation where supported. Recommend at most three templates with reasons. Preview using the owner's real menu. Recommendations never force a selection.

### Brand customization
Upload/replace logo; select palette or edit semantic colors; choose curated typography pairing; choose light/dark/cream theme where supported; tune image treatment, corner shape, spacing density and motion intensity within safe limits; enable/reorder supported story, gallery, location, hours, contact and social sections. Preview phone/tablet/desktop.

### AI media review
Upload original, preserve it immutably, create derivatives, optionally analyze/enhance/remove background, compare original and result, accept/reject, then attach approved version. AI must never silently overwrite or invent menu facts.

### Publishing
Validate content and assets, preview draft, publish immutable snapshot, create public slug and QR, keep future edits as draft, allow rollback/unpublish.

### Public visitor
Open QR/link, see fast entry/hero if used, browse categories and items, inspect details/variants/prices and only owner-approved dietary notes, access story/location/hours/contact/social if enabled. Support touch, keyboard, screen reader, reduced motion.

## 4. Functional requirements

- FR-001: register, sign in/out, recover account.
- FR-002: create/update restaurant profile; support multiple restaurants per owner.
- FR-003: invite editors/viewers with scoped permissions (later).
- FR-010: CRUD/reorder/hide menus, categories, items, variants.
- FR-011: item supports name, description, photo, category, price/currency.
- FR-012: CSV import with mapping and validation preview (P1).
- FR-013: explicit currency and price display settings.
- FR-014: owner-supplied ingredient/allergen/dietary fields must be distinguished from AI suggestions.
- FR-020: client logo upload, replace, remove, preview.
- FR-021: curated and custom palettes; optional logo color extraction suggestions.
- FR-022: template gallery and previews using real restaurant data.
- FR-023: switching templates never loses menu data.
- FR-024: template-specific validated settings and section toggles.
- FR-030: preserve original media; generate responsive variants.
- FR-031: optional AI quality analysis, crop/alt-text suggestions, background removal, generative edits.
- FR-032: AI edits/copy require owner approval; original never overwritten.
- FR-040: preview unpublished draft; publish/unpublish; unique public slug.
- FR-041: public page reads published snapshot only; rollback previous version.
- FR-042: QR code and SEO/Open Graph metadata (P1).

## 5. Restaurant story sections

Optional sections: Our Story, chef/founder profile, philosophy/sourcing, interior/atmosphere gallery, signature dishes, location/map link, opening hours, contact, social links, seasonal announcements. Templates declare which sections they support. A visitor must always be able to reach the full menu quickly; storytelling cannot block practical menu use.

## 6. Conceptual data model

User(id,email,created_at); Restaurant(id,owner_id,name,slug,description,logo_asset_id,address,phone,email,website,social_links_json,hours_json,currency,locale,timezone); Membership(id,restaurant_id,user_id,role); Menu(id,restaurant_id,name,description,type,locale,is_active,sort_order); Category(id,menu_id,name,description,image_asset_id,sort_order,is_visible); MenuItem(id,category_id,name,short_description,long_description,price_amount,currency_code,primary_asset_id,is_featured,is_available,is_visible,ingredients_json,allergens_json,dietary_labels_json,sort_order); ItemVariant(id,menu_item_id,name,price_amount,is_available,sort_order); MediaAsset(id,restaurant_id,original_asset_id,storage_key,mime_type,width,height,file_size,checksum,role,status); Template(id,slug,name,version,config_schema_json,capabilities_json); SiteConfiguration(id,restaurant_id,template_id,template_version,theme_tokens_json,config_json,enabled_sections_json); PublishedVersion(id,restaurant_id,snapshot_json,template_version,published_by,created_at); AIJob(id,restaurant_id,source_asset_id,job_type,provider,model,options_json,status,result_asset_ids_json,error_code,created_at,completed_at).

Use integer minor units or decimal-safe money, never float. Add indexes, foreign keys, and tenant scoping.

## 7. Non-functional requirements

Mobile-first on variable networks; WCAG 2.2 AA target; semantic HTML; keyboard/focus/contrast; prefers-reduced-motion; core browsing works without WebGL; lazy-load non-critical imagery; split template-specific code; secure uploads; RLS plus server authorization; secrets server-side; public routes expose published data only; SEO only from verified owner data; no secrets or unnecessary personal data in logs.

## 8. AI safety

AI must not certify allergens, ingredients, nutrition, or dietary suitability. AI descriptions are drafts. Visual recognition is uncertain. Generated images must be reviewed. Preserve originals and record provider/model/operation. Do not publish AI output without owner approval.

## 9. Explicitly out of scope for v1

Ordering, checkout, payment, delivery, reservations, POS, inventory, loyalty, table management, automated nutrition/allergen claims.

## 10. MVP acceptance

Owner creates restaurant, uploads logo, configures palette, creates menu/category/item with required content and image, previews at mobile/desktop, selects at least two genuinely different templates, publishes and shares URL, public visitor browses without login, draft edits do not change live snapshot until republished, original images remain, AI requires approval, tenant isolation passes, reduced-motion and keyboard work.
