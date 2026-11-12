# UrOwnMenu — Media Preparation (implemented)

This document records what the photo pipeline actually does, which models are
enabled, and why. It is the implementation record required by
`docs/AI_MEDIA_PIPELINE.md` and `docs/MODEL_CATALOG.md`.

## Where it lives

| Concern | File |
|---------|------|
| Processing pipeline | `apps/web/src/media.ts` |
| Editor UI | `apps/web/src/MediaEditor.tsx` |
| Upload + storage | `apps/api/index.ts` (`storeAsset`, `/media/*`) |
| Schema | `apps/api/migrations/0002_media_dimensions.sql` |

## Pipeline steps

1. **Validate** — `inspectImageFile()` checks MIME, size (<= 25 MB) and
   dimensions (>= 64x64) before any work happens.
2. **Preserve the original** — the uploaded original is stored once and is
   never overwritten. Derivatives are separate `media_assets` rows with their
   own `storage_key`.
3. **Optional cutout** — ONNX background removal, on explicit request only.
4. **Deterministic adjustments** — browser Canvas: crop, subject position,
   exposure, contrast, saturation, white balance, restrained sharpening.
5. **Derivative** — PNG when the result is a cutout (transparency must
   survive), JPEG otherwise, longest edge capped at 1400 px.
6. **Compare and approve** — the editor shows a live preview with a
   "hold to compare original" control. Nothing is uploaded until the owner
   presses **Use this photo**.
7. **Store** — binary goes to R2 (`MEDIA` bucket); D1 keeps only metadata
   (key, mime, byte size, checksum, width, height).

## Enabled models

Both models are permissively licensed and were checked against
`docs/MODEL_CATALOG.md` before being enabled. Both are downloaded from the
Hugging Face CDN **only when the owner asks for them**, and are then cached
in the browser.

| Key | Repository | Weight license | Quantized size | Best for |
|-----|-----------|-----------------|----------------|----------|
| `ormbg` | `onnx-community/ormbg-ONNX` | Apache-2.0 | ~42 MB | Food, drinks, products on a plain surface (default) |
| `modnet` | `Xenova/modnet` | Apache-2.0 | ~6 MB | People and pets |

Runtime: `@huggingface/transformers` 4.3.2 (Apache-2.0) via ONNX Runtime
Web. The library is code-split into its own chunk and is never downloaded
unless background removal is requested.

### Models that were considered and rejected

| Candidate | Reason rejected |
|-----------|-----------------|
| `@imgly/background-removal` | AGPL-3.0 — not acceptable for a commercial product. |
| `briaai/RMBG-1.4` / `RMBG-2.0` | Weights are published under a non-commercial ("other") licence. |
| `onnx-community/BiRefNet_lite-ONNX` | MIT licence is acceptable, but the smallest build is 109 MB — too heavy for owners on mobile data. |

## Cropping: the fix

Templates previously applied `object-fit: cover` with a hard-coded
`aspect-ratio`, which cropped a portrait dish photo (1200x1508) into a
16:10 landscape box and cut off most of the food.

Now:

- The owner chooses the framing in the media editor (aspect ratio preset plus
  a horizontal and vertical focal point).
- The prepared derivative is stored with its real `width` / `height`.
- The templates read those dimensions and set the aspect ratio inline, with
  `object-fit: contain` and a `max-height` cap.

The result is that the dish is shown whole, at the owner's chosen framing,
letterboxed rather than sliced.

## Cost

| Item | Cost |
|------|------|
| Deterministic adjustments | $0 (browser Canvas, no inference) |
| Background removal | $0 (open-source model, runs in the browser) |
| Model hosting | $0 (Hugging Face CDN, optional, on request only) |
| Storage | $0 (Cloudflare R2 free tier) |
| **Total** | **$0, no payment card, no paid service** |

## Safety

- The photo is never sent to a third-party service. Model inference runs
  locally in the browser via ONNX Runtime Web.
- AI never infers ingredients, allergens, nutrition, dietary suitability or
  prices. Only the owner's own text is used for those.
- The cutout is a visual asset only. It is never presented as evidence of
  what a dish contains.
- The owner approves the result; the original is always recoverable.
