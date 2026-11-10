# AI Service Layer and Free/Open-Source Model Strategy

## Product decision

UrOwnMenu should be local/self-hosted-first and avoid mandatory paid inference APIs. Use open-source software and pretrained open-weight models that can be downloaded from Hugging Face and run on our own worker. No model training and no autonomous general-purpose agent is needed. "Free" means no per-request vendor API fee; hosting, GPU/CPU time, RAM, storage, bandwidth and maintenance still cost money. Hugging Face hosted inference is not assumed to be free or unlimited.

Keep the AI service provider/model-agnostic. The application calls our own FastAPI endpoints, never Hugging Face or model runtimes directly.

## Recommended architecture

Next.js app -> authenticated FastAPI AI Service Layer -> task router -> specialized pipeline -> local model runtime / deterministic image tools -> output storage -> approval UI.

- Use FastAPI as the stable internal API and job orchestrator.
- Use Pydantic AI as an optional typed agent/orchestration SDK for bounded text/vision tasks. It supports self-hosted Ollama models; see https://pydantic.dev/docs/ai/models/ollama/.
- Use Ollama as the easiest first local model runner and OpenAI-compatible local endpoint. Keep runtime behind an adapter so vLLM or llama.cpp can replace it later.
- Use Pydantic schemas and deterministic Python code for all critical transformations. Do not give the LLM unrestricted shell, filesystem, database or publishing tools.
- Do not deploy a large all-purpose agent framework (Nanobot, OpenClaw-like systems, etc.) inside the customer-facing production application. Those are personal-agent runtimes, not necessary for fixed media/menu workflows.
- Jobs are asynchronous, retryable, idempotent, observable and approval-gated.

## First candidate models/tools to evaluate

These are candidates, not unconditional dependencies. Pin exact model revision and inspect each model card, weight license, upstream code license, commercial terms, hardware requirements and safety notes before enabling in a paid product.

### 1. Text reasoning, menu copy drafts and structured suggestions

- Hugging Face: https://huggingface.co/Qwen/Qwen3-4B — Apache-2.0 model card. Candidate for short copy drafts, categorization, template recommendation explanations and structured outputs on a capable host.
- Runtime: Ollama first; use structured JSON/Pydantic validation. A smaller quantized variant may reduce hardware needs, but validate quality before choosing.
- Do not use it to invent ingredients, allergens, nutrition, prices or availability. Only rephrase owner-provided facts; mark generated copy as draft.

### 2. Image understanding / visual quality assistant

- Hugging Face: https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct — Apache-2.0 model card. Candidate for identifying broad visual composition, detecting likely crop/lighting issues, suggesting alt text, and checking whether an uploaded photo appears to contain a single food/drink subject.
- Alternative/older candidate: https://huggingface.co/Qwen/Qwen2.5-VL-3B-Instruct — verify current model card and license before use.
- Never infer exact recipe, ingredients, allergens, dietary suitability, nutrition or portion facts from pixels. Vision output is uncertain and must be shown as suggestions.

### 3. Background removal / foreground cutout

- GitHub: https://github.com/danielgatis/rembg — useful Python integration and model-loading framework; repository license does not automatically grant commercial rights to every downloaded weight.
- Evaluate U²-Net, ISNet and BiRefNet family weights individually. Do not assume all weights share rembg's MIT license.
- Explicit caution: BRIA RMBG-2.0 is not a default commercial choice; its model license requires separate commercial permission/agreement. Confirm exact current terms before using.
- Test plates, transparent glasses, ice, steam, cheese, sauce, leafy garnish, fine crumbs, shadows and hair-like herbs. Use manual edge refinement/fallback where masks fail.

### 4. Image enhancement / upscale

- GitHub: https://github.com/Maty3k/Upscaler — local photo enhancement project; its repository states Apache-2.0 and uses pretrained Real-ESRGAN weights. Audit the exact bundled/downloaded weights and dependencies before commercial deployment.
- Use deterministic Pillow/OpenCV operations first: EXIF orientation, resize, crop, exposure, white balance, contrast and restrained sharpening.
- Upscaling cannot restore genuine detail that was never captured. Do not describe hallucinated detail as real.

### 5. Optional image generation

- Hugging Face: https://huggingface.co/black-forest-labs/FLUX.1-schnell — Apache-2.0 model card; 12B parameter model, so not a lightweight default and requires substantial hardware.
- GitHub: https://github.com/black-forest-labs/flux — official implementation/docs.
- FLUX.1 [dev], Kontext dev, Krea dev and Fill have different non-commercial license restrictions; do not assume the Schnell license applies to the rest of the family.
- Use generation only for optional decorative campaign backgrounds or approved art direction, not to replace the factual product photo by default. A generated dish may change toppings, shape, ingredients or quantity.

### 6. Optional image-to-3D

- Hugging Face: https://huggingface.co/microsoft/TRELLIS.2-4B — model card lists MIT; weights are very large (reported 16.2 GB on the model repository) and inference is hardware intensive. Keep as an experimental future capability, not MVP.
- GitHub: https://github.com/microsoft/TRELLIS
- One image cannot reveal hidden sides. Generated mesh/texture may hallucinate details. Use only as an optional decorative approximation with explicit owner approval, never as the factual menu representation. Keep 2.5D cutout as the dependable path.

### 7. Depth estimation warning

- Hugging Face Depth Anything V2 Base model card: https://huggingface.co/depth-anything/Depth-Anything-V2-Base-hf lists CC-BY-NC-4.0. Do not use this checkpoint commercially.
- Do not select depth models based only on popularity. Find a commercially permitted checkpoint and inspect the exact license. Depth is approximate; keep displacement subtle and provide flat fallback.

## Task routing — do not build one giant agent

- image_quality_check: vision model -> typed suggestions; no automatic destructive edit.
- alt_text_draft: vision model -> short neutral alt text -> owner can edit.
- menu_copy_draft: text model using owner-supplied item facts -> draft only.
- category_suggestion: text/vision model -> suggested category -> owner confirms.
- crop_suggestion: vision model or deterministic saliency -> crop coordinates -> preview and confirm.
- background_remove: segmentation model -> transparent derivative -> owner preview.
- image_enhance: deterministic operations and optional upscaler -> compare -> owner approves.
- generate_background: optional local image generation -> creative asset, clearly labeled.
- make_motion_asset: approved cutout + optional safe depth layers -> 2.5D scene asset. Do not generate a fake 3D dish by default.

Every task has a strict input/output Pydantic schema, timeout, resource limit, retry policy and audit record. No autonomous tool loops for predictable jobs.

## Media pipeline

1. Validate upload (content sniffing, file size, dimensions, malware scanning where available); store immutable original.
2. Normalize EXIF orientation and create responsive WebP/AVIF derivatives.
3. Optional quality analysis: blur, exposure, crop, subject visibility; return reasons and confidence.
4. Optional deterministic correction with conservative limits.
5. Optional background removal with model-specific adapter.
6. Optional depth/cutout preparation for 2.5D.
7. Optional generative background or campaign asset only after explicit user action.
8. Show original and candidate side-by-side, allow zoom and template preview.
9. Owner approves/rejects/retries/restores; only approved derivatives can be published.
10. Retain original and full provenance.

## Generative edit constraints

When image generation/editing is offered, prompt and UI must state what may change. Preserve exact dish/drink identity, visible ingredients, quantity, shape, toppings, texture, vessel and container. Do not add/remove food or garnish, alter portion size, or invent steam. Prefer generating/editing only the background around a locked foreground cutout. Compare outputs. If the dish changes, label it creative-only and never use as factual menu photography.

## Motion-ready photo levels

- Level 1 MVP: segmentation -> transparent cutout -> edge cleanup -> CSS transforms, controlled shadow and subtle parallax. This is 2.5D.
- Level 2: separate background/foreground or approved depth layers; only small displacement and blur; test edges and occlusion; keep flat fallback.
- Level 3 future: image-to-3D model; heavy GPU, uncertain unseen geometry, explicit owner opt-in and approval. Never required for a template to work.

## Service API sketch

- POST /v1/jobs/image-quality
- POST /v1/jobs/remove-background
- POST /v1/jobs/enhance
- POST /v1/jobs/alt-text
- POST /v1/jobs/menu-copy
- POST /v1/jobs/motion-assets
- GET /v1/jobs/{job_id}
- POST /v1/jobs/{job_id}/approve
- POST /v1/jobs/{job_id}/reject

Use authenticated ownership checks; jobs belong to restaurant_id and source asset. Public menu never calls AI at request time.

## Job record

Store job_id, restaurant_id, requester_id, source_asset_id/checksum, task_type, provider/runtime, model_id/revision, model_license_reviewed_at, parameters, status, outputs, error_code, created_at, completed_at, approval_state and estimated resource usage. Make retries idempotent.

## Deployment and cost strategy

- Development: run Ollama and model weights on developer machine; use a mock AI adapter for tests.
- Initial production: deploy FastAPI on a machine with suitable RAM/GPU only if available; otherwise enable CPU-friendly tasks (Pillow, ONNX segmentation) and queue expensive tasks for later. Do not assume Vercel can run large PyTorch models.
- Model weights should be downloaded once and cached on persistent storage; do not redownload per job.
- Add per-restaurant quotas, queue concurrency, max image dimensions, job timeouts, cancellation and cleanup.
- If the hosting budget cannot support a GPU, launch with deterministic enhancement and segmentation that fits CPU/ONNX, and make generative/3D actions unavailable until suitable hardware exists.
- No mandatory Hugging Face Inference API, Replicate, OpenAI, Gemini, or other metered provider. Optional adapters may be added later, disabled by default.
- Track RAM, VRAM, latency, failure rate and cost per operation.

## License and release gate

Before production, maintain a MODEL_CATALOG.md with model ID, exact revision, model license, code license, commercial permission status, attribution obligations, model size, hardware profile, known failure cases and approval date. A model is blocked if its commercial rights are unclear or non-commercial. Model cards and licenses can change; re-check before release.

## Safety

AI never certifies allergens, ingredients, nutrition or dietary suitability. Owner-provided facts remain authoritative. Keep originals. Never publish AI outputs automatically. Keep secrets server-side. Disclose any third-party processing if an optional hosted adapter is ever enabled.
