# Model Catalog — free-first and license-aware

Candidates only; not blanket approval. Production MVP may use only Workers AI model IDs confirmed Free-eligible for this account. Check live catalog and test before enabling. Current documented free allocation: 10,000 Neurons/day. Some models require Workers Paid.

## MVP candidates
| Task | Candidate | Gate |
|---|---|---|
| Text menu copy/organizing | `@cf/meta/llama-3.1-8b-instruct-fp8` or smaller free model | Confirm Free account access and output quality |
| Vision / alt text | `@cf/llama-3.2-11b-vision-instruct` | Optional; confirm Free access and license |
| Template recommendation | Deterministic rules first | Works with AI off |
| Image adjustments | Browser Canvas | No inference |
| Background removal | Optional browser ONNX | Exact weight license, browser RAM/performance and download size must pass |

Live catalog: https://developers.cloudflare.com/workers-ai/models/
Pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/

## Future/local-only candidates — not hosted MVP
- Qwen3-4B: https://huggingface.co/Qwen/Qwen3-4B
- Qwen3-VL-4B-Instruct: https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct
- rembg: https://github.com/danielgatis/rembg (wrapper license does not cover every model weight)
- Upscaler: https://github.com/Maty3k/Upscaler (audit exact weights/dependencies)
- FLUX.1 Schnell: https://huggingface.co/black-forest-labs/FLUX.1-schnell (heavy; future)
- TRELLIS.2: https://huggingface.co/microsoft/TRELLIS.2-4B (heavy, approximate 3D; future)

For every enabled model record immutable revision, model/weight license, code/dependency licenses, commercial-use permission, attribution, size, RAM/VRAM, known failures, evaluation and review date. Do not infer weight license from wrapper license. Block unclear/non-commercial models.

## Agent policy
Bounded Menu Copy Assistant, Menu Organizer, Template Recommender, Visual Review Assistant and browser Media Preparation only. No autonomous tool-using agent. No agent can publish or modify data. Owner approval required. Never infer/certify allergens, ingredients, nutrition or dietary suitability from photos.
