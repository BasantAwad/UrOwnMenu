# Third-party UI resources

Provenance record for every external design, component and reference resource
used in UrOwnMenu, following the adoption guidance in the
`open-source-ui-resources` skill.

Only resources whose licence was **verified** are listed. Resources that were
read for technique but whose code was not copied are listed separately as
inspiration.

## Adopted dependencies

| Resource | Source | Version | Licence (verified) | Changes | Required notice |
|---|---|---|---|---|---|
| Motion (React adapter) | https://github.com/motiondivision/motion | 14.12.0 | MIT | None. Used via `motion/react` for springs, shared-layout transitions, scroll-linked parallax and `AnimatePresence` page turns. | MIT notice retained in `node_modules` |
| React Bits | https://github.com/DavidHDev/react-bits | commit 7381f14 | MIT **+ Commons Clause v1.0** | **No source copied.** Used as a technique reference only. See "Rejected for copying" below. | Not applicable - no code copied |
| @animate-ui/react | https://github.com/imskyleen/animate-ui | 2.4.3 | MIT | **Now used.** `Fade`, `Blur` and `Magnetic` are imported from `@animate-ui/react/primitives/effects/*` in `apps/web/src/templates.tsx` (Editorial hero title blur-in, CTA magnetic pull). Components are consumed as published, not vendored; the licence notice lives in `node_modules`. | MIT notice retained in `node_modules` |
| Magic UI | https://github.com/magicuidesign/magicui | latest | MIT | **No source copied.** Technique reference only (Tailwind-based; incompatible with this project's plain-CSS token architecture). | Not applicable - no code copied |
| motion-ref skill | https://github.com/joepUI/motion-ref-skill | latest | MIT | **No source copied.** Its category notes supplied the measured duration and easing ranges used in `apps/web/src/motion.ts`. | Not applicable - no code copied |
| TuneShape | https://github.com/orocoa/TuneShape | latest | MIT | **No source copied.** Its published `effects/catalog.json` supplied the house easing, spring constants, press feedback and transition durations. | Not applicable - no code copied |
| react-native-magic-move | https://github.com/IjzerenHein/react-native-magic-move | commit (archived 2021) | MIT | **No source copied.** The shared-element projection technique it demonstrates was re-implemented on the web with Motion springs. | Not applicable - no code copied |
| SmoothMotion | https://github.com/abdullahalhakimi/SmoothMotion | latest | Apache-2.0 | **Not applicable.** Kotlin for Jetpack Compose, not web. Its taxonomy of common UI interactions was informative; no code could be used. | Not applicable |
| animated-bottle-scroll | https://github.com/pixelgridui/animated-bottle-scroll | none | **No licence** | **Not usable as a source.** Referenced only as a visual reference for a beverage brand showcase. | Not applicable |
| harborhaven | https://github.com/devxbynikhil/harborhaven | none | **No licence** | **Not usable as a source.** Referenced only as a visual reference for a beverage brand landing page. | Not applicable |
| Transformers.js | https://github.com/huggingface/transformers.js | 4.3.2 | Apache-2.0 | Used for in-browser ONNX background removal (MODNet / ormbg weights). | Apache-2.0 notice retained |
| Openverse | https://openverse.org | API v1 (queried live) | Data available under CC0 / PDM / CC-BY / CC-BY-SA (filtered server-side to those four) | Ingredient macro photography resolved at publish time by name search only. No key, no card. Images are downloaded into R2, never hotlinked, and every one is credited in the public menu footer with creator, licence and source link. | Attribution shown in menu footer |
| Wikimedia Commons | https://commons.wikimedia.org | MediaWiki API (queried live) | Free licences per file (read from extmetadata); mostly CC-BY / CC-BY-SA / PD | Fallback resolver when Openverse returns nothing suitable; same R2 storage and footer attribution. | Attribution shown in menu footer |
| ONNX Runtime Web (transitive) | via `@huggingface/transformers` | pinned by Transformers.js | MIT | None. | MIT notice retained |
| MODNet weights | https://huggingface.co/Xenova/modnet | `model_uint8.onnx` | Apache-2.0 | Loaded on explicit request only. | Apache-2.0 notice retained |
| ormbg weights | https://huggingface.co/onnx-community/ormbg-ONNX | `model_quantized.onnx` | Apache-2.0 | Loaded on explicit request only. | Apache-2.0 notice retained |
| lucide-react | https://github.com/lucide-icons/lucide | - | **Removed.** Installed while evaluating an icon strategy, then unused because the templates use typographic marks rather than iconography. Unused dependencies are not shipped. | Not applicable |
| Animata | https://github.com/codse/animata | 2,802+ stars (kit, latest) | MIT (LICENSE file checked) | **No source copied.** Its `Orbiting items` component (`docs/list/orbiting-items`) supplied the continuous-rotation technique used by the Orbital Menu: the ring rotates 360 degrees linearly, each chip counter-rotates at the same rate so the dish stays upright, the whole thing pauses on hover, and transforms only (compositor-friendly). The implementation here uses CSS keyframes and plain elements, not its React source. | Not applicable - no code copied |
| normalize.css | https://github.com/necolas/normalize.css | - | **Removed.** The project already has a complete reset in `index.css`/`App.css`. A second reset would be a conflicting global layer, which the selection guidance explicitly warns against. | Not applicable |
| qrcode | https://github.com/soldair/node-qrcode | latest | MIT | SVG QR generation. | MIT notice retained |

## Code-drawn artwork (no third-party asset)

`apps/web/src/design/generated.tsx` draws the plate study used when a dish
has no photograph. It is original SVG generated at runtime from the item's id
and the restaurant's palette tokens: no model, no generated image, no paid
API, no third-party artwork, and nothing to attribute. The design is
decorative and deliberately does not depict a specific dish.

## Agent tooling installed locally (not project source)

| Resource | Source | Licence | Use |
|---|---|---|---|
| baoyu-design skills (9) | https://github.com/jimliu/baoyu-design | Mixed: maintainer's own tooling is MIT; the skill briefs and reference docs adapted from Anthropic's Artifact types are Anthropic material and are **not** under the MIT licence, per the repo's NOTICE.md | Installed as **personal agent tooling** in `~/.agents/skills/` (claude-slides, claude-design, claude-design-system, claude-dashboard, claude-motion, motion-director, claude-whiteboard, dataviz, release-skills). Not vendored into this repository, not shipped with the product, and no code from it is copied into `apps/`. |
| open-3d-skills (8) | https://github.com/moh4696/open-3d-skills | MIT | Personal agent tooling in `~/.agents/skills/` (alpha-cutout, cursor-rig, exploded-view, frame-capture, motion-assets, scroll-film, site-check, threejs-scene). Three.js scenes, scroll films, exploded views, capture checks. |
| gsap-skills (8) | https://github.com/greensock/gsap-skills | MIT | Official GreenSock skills, personal agent tooling in `~/.agents/skills/` (gsap-core, gsap-frameworks, gsap-performance, gsap-plugins, gsap-react, gsap-scrolltrigger, gsap-timeline, gsap-utils). |
| threejs-animation | https://github.com/CloudAI-X/threejs-skills (skills/threejs-animation) | MIT | Single-file skill installed as personal agent tooling; only `threejs-animation` from that repo, the file the owner named. |
| web3d-integration-patterns | https://github.com/freshtechbro/claudedesignskills (.claude/skills/web3d-integration-patterns) | MIT | Single-file integration-patterns skill installed as personal agent tooling. Its SKILL.md advertises bundled `references/` and `starter_unified/` assets that do not exist in the upstream repo (checked against the git tree); the skill is self-contained. |

## Design reference servers (data only, no code)

| Tool | Source | Licence | Use |
|---|---|---|---|
| awwwards-mcp | https://github.com/INSANE0777/Awwwards-mcp | MIT | Searched Awwwards for award-winning restaurant and food sites; used `create_design_brief`, `analyze_page_structure`, `analyze_hover_census`, `get_motion_dna`, `analyze_accessibility`, `analyze_images` and `capture_live_site` to measure reference band structure, motion behaviour and accessibility, and to capture this project's own build for visual review. |
| refero-design-mcp | https://github.com/DarCas/refero-design-mcp | MIT | Extracted measured design systems (palette roles, type pairing, surface ladders) via `refero_search_styles` and `refero_get_design_md`. |
| A1 Gallery MCP | https://github.com/bryntay/a1-mcp | MIT | Evaluated; requires OAuth 2.1 browser sign-in, so it was not usable in this environment. Not adopted. |

## Rejected for copying

| Resource | Reason |
|---|---|
| React Bits source | MIT + Commons Clause. The licence permits use inside an application or product, but prohibits **selling, sublicensing or redistributing the components themselves, including ported copies**. Copying component source into this repository would redistribute it. Techniques were re-implemented instead. |
| Animate UI source | Same Commons Clause restriction. Its README badge says "MIT" but the actual LICENSE file carries the extra condition; the LICENSE governs. |
| Magic UI source | MIT but the components are Tailwind + Framer Motion specific. Adopting them would require adding a CSS framework and a second animation runtime to a project that deliberately uses plain CSS tokens and one motion library. |
| `@imgly/background-removal` | AGPL-3.0. Not acceptable for a commercial product. |
| `briaai/RMBG-1.4`, `briaai/RMBG-2.0` | Weights published under a non-commercial ("other") licence. |
| `onnx-community/BiRefNet_lite-ONNX` | MIT weights, but the smallest build is 209 MB - too heavy for a menu read on mobile data. |
| BEN2 (`onnx-community/BEN2-ONNX`) | MIT weights, 209 MB. Used by Oddments locally; too heavy for the browser path here. |

## Inspiration-only references

Read for design direction, nothing copied:

- `docs/INSPIRATION.md` section 1 - Wove mobile navigation (numbered orbital
  category navigation).
- `docs/INSPIRATION.md` section 2 - food orbital composition.
- `docs/INSPIRATION.md` section 3 - rotating drink with floating ingredients.
- `docs/INSPIRATION.md` sections 4-6 - hero then menu, continuous scrolling
  menu, magazine spreads.
- Refero "Assembly Coffee London"
  (https://styles.refero.design/style/8288950a-2731-44fd-85ef-211aecd8091d) -
  direction only for the Editorial template: near-black editorial ground,
  italic/serif-adjacent item names, hairline rules instead of cards, curated
  numbered index. No code, typeface file, colour value or layout was copied.
- `docs/DESIGN_SYSTEM.md` - the eight brand palettes and their roles.
- `docs/MODEL_CATALOG.md` - the licence-first selection policy that produced
  this table.
- `oddments` (https://github.com/peopleskynet-boop/Oddments) - local-first
  reference library; its use of BEN2 for background removal informed the
  model choice, but the app runs the model in the browser instead.
- `prompt-seen` (https://github.com/picontapLab/prompt-seen) - image prompt
  library. Not used: `docs/AI_MEDIA_PIPELINE.md` disables AI image generation
  in the MVP because it can change dish identity.
- User-provided inspiration photographs (Drinko coffee site, two
  deconstructed-pizza posters, Dolce desserts board, AKME poster grid,
  pistachio-macaron split) - read for layout, palette and art direction
  only. No image, copy, logo or layout grid was copied into the build; the
  templates are original implementations of the observed techniques.

## Verification scope

Licences were checked against the upstream `LICENSE` file or the model card
`license` field on the date recorded in `docs/DESIGN_DECISIONS.md`. Where a
catalogue label and the actual licence file disagreed (Animate UI), the
licence file was treated as authoritative.
