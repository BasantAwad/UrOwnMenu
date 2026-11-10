# Motion, Geometry, 3D and Interaction Quality

## Core principle

The wow factor is precise art direction and coherent physical illusion, not random movement. For every animation specify initial/final positions, transform origin, scale/rotation, depth plane, easing/spring, duration/stagger, trigger, interruption behavior, responsive adaptation and reduced-motion equivalent.

## Tool choice

Motion for React is default for component transitions, gestures, drag, springs, layout and scroll-linked animation. GSAP only for complex coordinated timelines. Three.js/React Three Fiber only for real 3D geometry, perspective, lighting or spatial interaction. CSS transforms for lightweight 2D/2.5D. Do not load all libraries into every template.

## Orbital geometry

Calculate node positions on an ellipse: x = centerX + radiusX*cos(theta), y = centerY + radiusY*sin(theta). Adapt radii to viewport, orientation, selected item bounds and item count. Keep selected dish in stable focus region and avoid text overlap. Use scale, opacity, small blur for decorative nonessential elements, shadow, z-order and slight perspective for depth. Never make unselected labels unreadable. Large menus require category groups/pagination.

On selection: rotate shortest path; move/scale selected dish into focus; recede others; transition title/description/price in sync; update active marker and accessible selected state; allow interruption without jump. Horizontal and vertical layout variants should be intentional.

## Ingredient scene geometry

Start with 2.5D DOM layers: central glass/plate, front/middle/back ingredient planes, stable label anchors, connector lines, subtle pointer/drag parallax. Keep light direction and contact shadows consistent. Ingredients enter along deliberate paths with stagger; hero remains dominant; labels appear after elements settle; no object crosses text or hero. Selecting ingredient highlights its label. Mobile simplifies depth and stacks labels. Ingredient facts must be owner supplied or approved.

## Photo to moving item — honest capability levels

**Level 1, recommended MVP:** pretrained foreground segmentation/background removal; transparent PNG/WebP cutout; refine edges; place in CSS scene with scale/rotation/shadow/parallax. This is 2.5D, not true 3D.

**Level 2:** layered subject/background or cautious pretrained depth estimate; subtle parallax and blur. Depth estimation can be wrong around food edges; keep displacement small and provide flat fallback.

**Level 3, future:** pretrained image-to-3D from one or multiple views. A single image cannot reveal hidden sides; mesh may hallucinate geometry and texture. Treat as decorative approximation only, require owner approval, never replace factual menu photo.

## Choreography examples

Orbital selection: shortest-path orbit rotation; selected image moves/scales to focus; others recede; text/price transition in sync; active point updates. Ingredient scene: labels quiet; hero changes; ingredients move between stable anchors; connectors/labels reveal after settling. Magazine: next spread enters from consistent edge; content never mirrored/unreadable; mobile uses swipe/list; reduced motion uses dissolve or instant switch.

## Timing guidance

Micro feedback roughly 120–180 ms; standard UI 180–320 ms; hero scene 350–700 ms. Use springs for direct manipulation and restrained easing for editorial reveals. Avoid excessive bounce. Never delay access to the menu for decorative intro.

## Responsive, accessibility, performance

Design mobile intentionally; maintain native scroll; comfortable touch targets; tap alternative to drag; no hover-only information; autoplay off by default and pauses on interaction/focus/hidden tab/reduced motion. Respect prefers-reduced-motion and offer calm state changes. Keyboard navigation; semantic item details; no facts only visible in 3D. WebGL failure leaves usable menu. Prefer transform/opacity over animating top/left/width/height. Pause offscreen animation, preload selected/next image only, avoid dozens of large transparent PNGs, lazy-load below fold, profile mid-range Android. Use will-change sparingly. No random parallax, endless auto-rotation, or scroll hijacking.

## Motion storyboard checklist

Focal point? What moves first? What stays anchored? Where does eye travel? Is depth believable? Are light/shadows coherent? Is text readable? Does movement help navigation/story? Mobile behavior? Reduced-motion behavior?
