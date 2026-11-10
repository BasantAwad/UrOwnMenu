# Model Catalog and Commercial License Review

This catalog is a shortlist for evaluation, not blanket approval. Before production, pin a commit/revision, read the exact model card and weight license, inspect upstream code/dependencies, verify commercial use and attribution, test the actual outputs, and record the review date. If unclear, do not ship the model.

| Task | Candidate | Model/Code license signal | Recommendation / caveat |
|---|---|---|---|
| Local text tasks | https://huggingface.co/Qwen/Qwen3-4B | Model card: Apache-2.0 | Candidate for owner-fact-grounded descriptions, categorization and structured suggestions. Benchmark on target hardware. |
| Local vision tasks | https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct | Model card: Apache-2.0 | Candidate for visual quality, crop suggestions and draft alt text. Never use to certify ingredients/allergens/nutrition. |
| Alternative vision | https://huggingface.co/Qwen/Qwen2.5-VL-3B-Instruct | Verify exact current card and license | Alternative if compatibility or hardware benchmarks are better. |
| Segmentation framework | https://github.com/danielgatis/rembg | Repository MIT; model weights have separate licenses | Evaluate U2-Net/ISNet/BiRefNet weights individually. Do not assume package license covers weights. |
| Segmentation alternative | https://github.com/TermiSenpai/DeleteBackground | Wrapper app uses rembg/ONNX | Useful implementation reference, not automatic commercial approval for every model it bundles. |
| Image enhancement | https://github.com/Maty3k/Upscaler | Repository states Apache-2.0; audit each downloaded weight/dependency | Candidate for local upscale/restore. Prefer conservative deterministic corrections first. |
| Image generation | https://huggingface.co/black-forest-labs/FLUX.1-schnell | Model card: Apache-2.0 | Optional heavy 12B model. Use only if server resources support it. |
| Image-to-3D | https://huggingface.co/microsoft/TRELLIS.2-4B | Model card lists MIT | Future experiment only; large weights and heavy inference; output is approximate, one image cannot reveal hidden surfaces. |
| Depth estimation (blocked) | https://huggingface.co/depth-anything/Depth-Anything-V2-Base-hf | Model card lists CC-BY-NC-4.0 | Do not use commercially under this license. Find a commercially permitted alternative before enabling depth estimation. |

## Runtime and orchestration

- Ollama: local model runtime, first choice for easy developer setup; https://ollama.com/ and https://github.com/ollama/ollama
- Pydantic AI: typed, model-agnostic orchestration; supports self-hosted Ollama; https://pydantic.dev/docs/ai/models/ollama/
- FastAPI: our application-owned AI Service Layer and job endpoints.
- ONNX Runtime: efficient inference for compatible segmentation/vision models.
- Pillow/OpenCV: deterministic image preprocessing and postprocessing.

## Required review fields

For every model actually enabled, add:
- Exact Hugging Face repo ID and immutable revision/commit.
- Model weight license and upstream source-code license.
- Commercial use: approved / blocked / legal review required.
- Attribution/notice requirements.
- Model size, RAM, VRAM, CPU/GPU compatibility and measured latency.
- Task-specific evaluation results and known failure modes.
- Provider/model version, date reviewed, reviewer.
- Removal/replacement plan.

No hosted inference API is required for MVP. Download weights to persistent worker storage. Model availability on Hugging Face does not mean hosted inference is free, nor does an open-source wrapper automatically make its weights commercially usable.
