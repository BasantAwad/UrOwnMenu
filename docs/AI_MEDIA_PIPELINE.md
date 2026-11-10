# AI and Media Pipeline

## Purpose

Improve owner-uploaded food/drink photography and optionally create motion-ready cutouts/scenes while preserving product truth. AI is optional, cost controlled, and never the source of truth for ingredients, allergens, nutrition, price or availability.

## Pipeline

1. Validate upload and store immutable original.
2. Generate responsive image derivatives.
3. Optional pretrained image-quality analysis and crop suggestion.
4. Optional deterministic correction: EXIF orientation, resize, crop, mild exposure/contrast/white balance/sharpness/noise.
5. Optional pretrained segmentation/background removal.
6. Optional generative scene/background edit after approval UI exists.
7. Compare original and candidate; owner approves/rejects/retries/restores original.
8. Attach approved derivative to item; original remains retained.

## Pretrained model recommendations

Use provider adapters. A pretrained multimodal vision model (e.g. Gemini vision or another commercially suitable provider) can suggest broad subject category, crop, quality issues, alt text and copy draft based only on owner-supplied factual context. It cannot certify exact ingredients/allergens/nutrition. For segmentation start with rembg/U²-Net or a maintained pretrained alternative. Test transparent glass, steam, sauce, cheese, garnish and plate edges. Pillow/OpenCV or CDN for deterministic image processing. Optional image editing model can create background/lighting scenes; check commercial terms, retention, costs and output rights before production. Do not train a model or agent from scratch.

## Generative edit constraints

Preserve exact same dish/drink, visible ingredients, quantity, shape, toppings, texture, serving vessel and container. Do not add/remove garnish or food, alter portion size, or invent steam. Change only requested background, lighting mood or composition around the product. Generative outputs may still change product details; compare visually. If accuracy cannot be trusted, label as creative-only and never use as factual product photo.

## Motion-ready media

MVP is 2.5D: segment foreground, export transparent cutout, preserve source, refine mask edges/halos, add separate contact shadow where possible, position in CSS scene with subtle transforms and coherent light direction. Optional depth model can create cautious layers and small parallax; never assume depth is exact. Future image-to-3D may create decorative mesh only; single photo cannot show hidden sides. Always keep original-photo fallback and owner approval.

## Jobs

FastAPI worker and job records. States queued, processing, succeeded, failed, cancelled. Record restaurant_id, requester, source asset/checksum, operation, provider/model/version, options, status, output asset IDs, safe error, timestamps, approval state. Jobs idempotent and retry-safe; no duplicate attachment on retry.

## Review interface

Original/result side by side or draggable comparison, zoom/crop, operation label, provider/model where useful, approve/reject/retry/restore. Show generated/AI-assisted labels. Preview inside selected template before publish. No AI output auto-published.

## Privacy and cost

Keep keys server-side. Review provider data retention, commercial rights, training policies. Disclose external AI processing. Set per-account and platform limits, cache by checksum/options, track cost per image, prefer deterministic local operations. Allow AI to be skipped entirely. Never send unnecessary personal data.
