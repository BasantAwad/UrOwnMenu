/**
 * UrOwnMenu — Generated art
 *
 * Free, deterministic artwork for the cases where a client has no photograph,
 * or where a template needs a deliberate surface behind type. Nothing here
 * calls a model or a paid API: every visual is drawn from the item's own name
 * and the restaurant's palette, so it stays on-brand and reproducible.
 *
 * Why this exists: a missing photo should not become a grey rectangle. A
 * plate, a monogram and a little grain read as an art-directed choice, and
 * they make a menu with sparse photography look intentional rather than
 * unfinished.
 */

/** Stable 32-bit hash, so the same dish always draws the same poster. */
export function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type PlatedPosterProps = {
  /** Stable seed; use the item id so it never changes. */
  seed: string
  /** The word that anchors the composition (usually the item name). */
  label: string
  className?: string
  /** 'ink' draws for light grounds, 'cream' for dark grounds. */
  tone?: 'ink' | 'cream'
}

/**
 * A generated "plate study": concentric rings, an off-centre disc and a
 * display monogram. Scales to any slot because it is a single SVG drawn to
 * fill, and it inherits the restaurant's palette through CSS variables.
 */
export function PlatedPoster({ seed, label, className, tone = 'ink' }: PlatedPosterProps) {
  const h = hashString(seed || label)
  const rotation = h % 360
  const rings = 2 + (h % 3)
  const offsetX = 38 + (h % 25)
  const offsetY = 34 + ((h >> 5) % 26)
  const monogram = (label.trim().match(/[A-Za-z0-9]/)?.[0] ?? '·').toUpperCase()
  const ink = tone === 'cream' ? 'var(--tpl-on-primary, #fff)' : 'var(--tpl-primary, #2b211d)'
  const accent = 'var(--tpl-accent, #b77a45)'

  /*
   * The drawing is transparent and `meet`, not `slice`. A filled rectangle
   * would become a visible box in a slot of another shape — exactly the
   * problem cutouts have — and slicing crops the composition when a card is
   * wide. Linework on no ground sits on whatever surface the template gives
   * it, at any aspect ratio.
   */
  return (
    <svg
      className={['tpl-poster', className].filter(Boolean).join(' ')}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
      data-generated="plate"
    >
      <defs>
        <linearGradient id={'pl-' + h} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.34" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.04" />
        </linearGradient>
      </defs>

      {/* Contact shadow, so the plate sits on the page rather than floats. */}
      <ellipse
        cx={offsetX}
        cy={offsetY + 25}
        rx="29"
        ry="7"
        fill={ink}
        fillOpacity="0.07"
      />

      {/* The plate: a soft disc, offset so it never looks like a UI circle. */}
      <circle cx={offsetX} cy={offsetY} r="27" fill={'url(#pl-' + h + ')'} />
      <circle
        cx={offsetX}
        cy={offsetY}
        r="27"
        fill="none"
        stroke={ink}
        strokeOpacity="0.18"
        strokeWidth="0.4"
      />
      <circle
        cx={offsetX}
        cy={offsetY}
        r="22.5"
        fill="none"
        stroke={ink}
        strokeOpacity="0.1"
        strokeWidth="0.3"
        strokeDasharray="1.5 2.5"
      />

      {/* Concentric rings, rotated per item. */}
      <g transform={'rotate(' + rotation + ' ' + offsetX + ' ' + offsetY + ')'}>
        {Array.from({ length: rings }, (_, i) => (
          <ellipse
            key={i}
            cx={offsetX}
            cy={offsetY}
            rx={33 + i * 6}
            ry={32 + i * 6}
            fill="none"
            stroke={ink}
            strokeOpacity={0.09 - i * 0.02}
            strokeWidth="0.3"
            strokeDasharray={i === 0 ? undefined : '1 3'}
          />
        ))}
      </g>

      {/* A single arc of accent, like a brush mark across the plate. */}
      <path
        d={
          'M ' + (offsetX - 21) + ' ' + (offsetY + 18) +
          ' Q ' + (offsetX + 3) + ' ' + (offsetY + 32) +
          ' ' + (offsetX + 23) + ' ' + (offsetY + 8)
        }
        fill="none"
        stroke={accent}
        strokeOpacity="0.55"
        strokeWidth="0.9"
        strokeLinecap="round"
      />

      {/* A small edition mark, not a giant initial competing with the type. */}
      <text
        x={offsetX}
        y={offsetY + 3.6}
        textAnchor="middle"
        fill={ink}
        fillOpacity="0.4"
        style={{
          fontFamily: 'var(--tpl-body)',
          fontSize: '6px',
          fontWeight: 500,
          letterSpacing: '0.18em',
        }}
      >
        {monogram}
      </text>

      {/* Registration ticks — a print cue, not decoration for its own sake. */}
      <g stroke={ink} strokeOpacity="0.18" strokeWidth="0.35">
        <path d="M7 7 h5 M7 7 v5" />
        <path d="M93 93 h-5 M93 93 v-5" />
      </g>
    </svg>
  )
}

/**
 * Film grain as a reusable overlay. One inline SVG turbulence filter, applied
 * through a background-image data URI, so it costs no network request.
 */
export const GRAIN_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")"

/** Renders a non-interactive grain layer for a section. */
export function Grain({ opacity = 0.16, className }: { opacity?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={['tpl-grain', className].filter(Boolean).join(' ')}
      style={{ backgroundImage: GRAIN_DATA_URI, opacity }}
    />
  )
}
