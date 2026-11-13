import { useId, type CSSProperties, type ReactElement } from 'react'

/* Illustrated, lit food cutouts. One light source (top-left, warm), one contact shadow model.
   Every piece has a fixed viewBox so aspect ratio never drifts. */

export type Dish = { w: number; h: number; render: (id: string) => ReactElement }

const Shadow = ({ id, cx, cy, rx, ry }: { id: string; cx: number; cy: number; rx: number; ry: number }) => (
  <>
    <radialGradient id={`${id}sh`}>
      <stop offset="0" stopColor="#000" stopOpacity=".75" />
      <stop offset=".6" stopColor="#000" stopOpacity=".28" />
      <stop offset="1" stopColor="#000" stopOpacity="0" />
    </radialGradient>
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id}sh)`} />
  </>
)

export const IcedCoffee: Dish = {
  w: 300,
  h: 520,
  render: (id) => (
    <>
      <defs>
        <linearGradient id={`${id}cof`} x1="0" x2="1">
          <stop offset="0" stopColor="#5a3a26" />
          <stop offset=".35" stopColor="#c08f66" />
          <stop offset=".7" stopColor="#8a5b3a" />
          <stop offset="1" stopColor="#3b2417" />
        </linearGradient>
        <linearGradient id={`${id}milk`} x1="0" x2="1">
          <stop offset="0" stopColor="#a98466" />
          <stop offset=".4" stopColor="#ecd3b8" />
          <stop offset="1" stopColor="#8d6a4f" />
        </linearGradient>
        <linearGradient id={`${id}glass`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset=".12" stopColor="#fff" stopOpacity=".08" />
          <stop offset=".85" stopColor="#fff" stopOpacity=".04" />
          <stop offset="1" stopColor="#fff" stopOpacity=".35" />
        </linearGradient>
        <linearGradient id={`${id}straw`} x1="0" x2="1">
          <stop offset="0" stopColor="#9b1224" />
          <stop offset=".5" stopColor="#e8283f" />
          <stop offset="1" stopColor="#8a0f1f" />
        </linearGradient>
        <clipPath id={`${id}clip`}>
          <path d="M62 150 L238 150 L222 478 Q150 496 78 478 Z" />
        </clipPath>
        <pattern id={`${id}dots`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
          <circle cx="3" cy="3" r="2.2" fill="#fff" opacity=".85" />
        </pattern>
      </defs>
      <Shadow id={id} cx={150} cy={494} rx={118} ry={16} />
      <g transform="rotate(-9 190 150)">
        <rect x="178" y="2" width="22" height="200" rx="11" fill={`url(#${id}straw)`} />
        <rect x="178" y="2" width="22" height="200" rx="11" fill={`url(#${id}dots)`} />
      </g>
      <g clipPath={`url(#${id}clip)`}>
        <rect x="40" y="150" width="220" height="340" fill={`url(#${id}milk)`} />
        <path d="M40 300 Q100 285 150 305 T260 295 L260 490 L40 490 Z" fill={`url(#${id}cof)`} />
        {[
          [100, 360, 40], [180, 330, 36], [140, 420, 38], [205, 410, 34], [95, 450, 32],
        ].map(([x, y, s], i) => (
          <g key={i} transform={`rotate(${i * 17} ${x} ${y})`}>
            <rect x={x} y={y} width={s} height={s} rx="5" fill="#fff" opacity=".16" />
            <rect x={x} y={y} width={s} height={s} rx="5" fill="none" stroke="#fff" opacity=".3" />
          </g>
        ))}
        <path d="M70 170 Q110 160 150 176 T238 168 L238 200 Q150 220 62 200 Z" fill="#f6e7d3" />
        <ellipse cx="150" cy="168" rx="78" ry="15" fill="#fbf1e3" />
        <path d="M92 164 q14 12 26 0 q10 20 24 2 q12 14 26 -2 q14 18 28 0" fill="none" stroke="#2a150c" strokeWidth="7" strokeLinecap="round" />
        <path d="M108 152 q10 -22 24 -8 q12 -20 28 -4 q14 -16 26 4" fill="#f9efe0" />
        {[[130, 150], [158, 142], [180, 152]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx="9" ry="6" fill="#4a2a18" transform={`rotate(${i * 30 - 20} ${x} ${y})`} />
        ))}
      </g>
      <path d="M62 150 L238 150 L222 478 Q150 496 78 478 Z" fill={`url(#${id}glass)`} stroke="#fff" strokeOpacity=".55" />
      <ellipse cx="150" cy="150" rx="88" ry="10" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="2" />
      <path d="M78 166 L92 462" stroke="#fff" strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" />
      <path d="M84 168 L96 300" stroke="#fff" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
}

export const LavaCake: Dish = {
  w: 420,
  h: 340,
  render: (id) => (
    <>
      <defs>
        <radialGradient id={`${id}plate`} cx=".4" cy=".3">
          <stop offset="0" stopColor="#f4f0e8" />
          <stop offset="1" stopColor="#bdb6a8" />
        </radialGradient>
        <linearGradient id={`${id}cake`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#5b2e1d" />
          <stop offset=".5" stopColor="#35170d" />
          <stop offset="1" stopColor="#1d0b05" />
        </linearGradient>
        <radialGradient id={`${id}lava`} cx=".5" cy=".4">
          <stop offset="0" stopColor="#7a3a1f" />
          <stop offset="1" stopColor="#2a0f06" />
        </radialGradient>
      </defs>
      <Shadow id={id} cx={210} cy={290} rx={190} ry={30} />
      <ellipse cx="210" cy="252" rx="190" ry="48" fill={`url(#${id}plate)`} />
      <ellipse cx="210" cy="248" rx="140" ry="32" fill="none" stroke="#9c9486" strokeOpacity=".5" />
      <path d="M96 238 Q96 120 210 112 Q324 120 324 238 Q210 274 96 238 Z" fill={`url(#${id}cake)`} />
      <path d="M130 150 Q160 124 215 122" stroke="#9a5a3a" strokeOpacity=".55" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M180 120 Q210 150 196 190 Q208 224 190 250 L250 250 Q232 214 244 186 Q238 150 244 120 Z" fill={`url(#${id}lava)`} />
      <ellipse cx="210" cy="256" rx="66" ry="12" fill="#3a1608" />
      <path d="M150 112 Q180 104 214 108" stroke="#fff" strokeOpacity=".25" strokeWidth="3" fill="none" strokeLinecap="round" />
      <g>
        {[[290, 196], [306, 214], [278, 212]].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="13" fill="#b3172e" />
            <circle cx={x - 4} cy={y - 4} r="4" fill="#fff" opacity=".35" />
          </g>
        ))}
        <path d="M282 178 q6 -14 18 -6 q-6 14 -18 6" fill="#3f6b3a" />
      </g>
      <path d="M130 244 q60 20 150 0" stroke="#000" strokeOpacity=".25" strokeWidth="8" fill="none" />
      <g opacity=".9">
        <path d="M110 262 l22 6 l-6 14 l-22 -6 z" fill="#2c140a" />
        <path d="M312 268 l24 -4 l4 14 l-24 4 z" fill="#2c140a" />
      </g>
    </>
  ),
}

export const OrangeJuice: Dish = {
  w: 300,
  h: 500,
  render: (id) => (
    <>
      <defs>
        <linearGradient id={`${id}oj`} x1="0" x2="1">
          <stop offset="0" stopColor="#c4540c" />
          <stop offset=".35" stopColor="#ffa43a" />
          <stop offset=".75" stopColor="#f07a14" />
          <stop offset="1" stopColor="#a9430a" />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset=".15" stopColor="#fff" stopOpacity=".06" />
          <stop offset=".85" stopColor="#fff" stopOpacity=".04" />
          <stop offset="1" stopColor="#fff" stopOpacity=".35" />
        </linearGradient>
        <radialGradient id={`${id}slice`}>
          <stop offset="0" stopColor="#ffd37a" />
          <stop offset="1" stopColor="#f58a12" />
        </radialGradient>
        <clipPath id={`${id}c`}>
          <path d="M58 120 L242 120 L226 462 Q150 478 74 462 Z" />
        </clipPath>
      </defs>
      <Shadow id={id} cx={150} cy={474} rx={118} ry={15} />
      <g clipPath={`url(#${id}c)`}>
        <rect x="40" y="150" width="220" height="330" fill={`url(#${id}oj)`} />
        <ellipse cx="150" cy="150" rx="92" ry="12" fill="#ffc46a" />
        {[[96, 300, 5], [190, 360, 7], [130, 410, 4], [200, 250, 4], [110, 220, 6]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity=".35" />
        ))}
      </g>
      <path d="M58 120 L242 120 L226 462 Q150 478 74 462 Z" fill={`url(#${id}g)`} stroke="#fff" strokeOpacity=".5" />
      <path d="M76 140 L90 440" stroke="#fff" strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" />
      <g transform="translate(212 108) rotate(18)">
        <circle r="54" fill="#f9a21e" />
        <circle r="46" fill={`url(#${id}slice)`} />
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={i} x1="0" y1="0" x2={Math.cos((i / 9) * Math.PI * 2) * 44} y2={Math.sin((i / 9) * Math.PI * 2) * 44} stroke="#fff3d0" strokeWidth="2.5" />
        ))}
        <circle r="6" fill="#fff3d0" />
      </g>
      <g transform="translate(100 112) rotate(-20)">
        <path d="M0 0 q18 -22 40 -8 q-16 24 -40 8z" fill="#3f7a3c" />
        <path d="M2 0 q18 -12 34 -8" stroke="#a6d79a" strokeWidth="1.5" fill="none" />
      </g>
    </>
  ),
}

/* Top-down round dishes for the orbit */
const rimShadow = (id: string, r: number) => (
  <>
    <Shadow id={id} cx={r} cy={r + r * 0.06} rx={r * 0.98} ry={r * 0.94} />
  </>
)

export const RoundDishes: Record<string, Dish> = {
  pizza: {
    w: 360, h: 360,
    render: (id) => (
      <>
        <defs>
          <radialGradient id={`${id}crust`} cx=".35" cy=".3"><stop offset="0" stopColor="#f2c27b" /><stop offset="1" stopColor="#b9772f" /></radialGradient>
          <radialGradient id={`${id}sauce`}><stop offset="0" stopColor="#d9482b" /><stop offset="1" stopColor="#a8301a" /></radialGradient>
        </defs>
        {rimShadow(id, 180)}
        <circle cx="180" cy="176" r="168" fill={`url(#${id}crust)`} />
        <circle cx="180" cy="176" r="144" fill={`url(#${id}sauce)`} />
        {[[120, 120], [220, 110], [250, 190], [190, 240], [110, 210], [180, 170], [150, 160], [236, 250], [90, 160]].map(([x, y], i) => (
          <g key={i}><ellipse cx={x} cy={y} rx="32" ry="26" fill="#fbf2dc" transform={`rotate(${i * 40} ${x} ${y})`} /><ellipse cx={x - 6} cy={y - 6} rx="12" ry="8" fill="#fff" opacity=".6" /></g>
        ))}
        {[[150, 210], [205, 135], [240, 220]].map(([x, y], i) => (<path key={i} d={`M${x} ${y} q12 -22 26 -4 q-8 18 -26 4`} fill="#2f6b34" />))}
        <circle cx="180" cy="176" r="168" fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="2" />
      </>
    ),
  },
  donut: {
    w: 360, h: 360,
    render: (id) => (
      <>
        <defs>
          <radialGradient id={`${id}d`} cx=".35" cy=".3"><stop offset="0" stopColor="#e9b574" /><stop offset="1" stopColor="#a96a2c" /></radialGradient>
          <radialGradient id={`${id}ic`} cx=".35" cy=".3"><stop offset="0" stopColor="#6a3a2a" /><stop offset="1" stopColor="#2e160d" /></radialGradient>
        </defs>
        {rimShadow(id, 180)}
        <circle cx="180" cy="176" r="164" fill={`url(#${id}d)`} />
        <circle cx="180" cy="176" r="138" fill={`url(#${id}ic)`} />
        <circle cx="180" cy="176" r="46" fill="#14100d" />
        <circle cx="180" cy="176" r="46" fill="none" stroke="#e9b574" strokeWidth="6" />
        {Array.from({ length: 22 }).map((_, i) => {
          const a = i * 2.4, r = 62 + (i * 37) % 70
          return <rect key={i} x={180 + Math.cos(a) * r} y={176 + Math.sin(a) * r} width="14" height="4" rx="2" fill={['#f6d58a', '#e9eee8', '#e46a6a'][i % 3]} transform={`rotate(${i * 31} ${180 + Math.cos(a) * r} ${176 + Math.sin(a) * r})`} />
        })}
        <path d="M80 110 Q120 60 200 54" stroke="#fff" strokeOpacity=".28" strokeWidth="6" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  tart: {
    w: 360, h: 360,
    render: (id) => (
      <>
        <defs>
          <radialGradient id={`${id}t`} cx=".35" cy=".3"><stop offset="0" stopColor="#e6c98f" /><stop offset="1" stopColor="#a98446" /></radialGradient>
          <radialGradient id={`${id}f`}><stop offset="0" stopColor="#f7e6a5" /><stop offset="1" stopColor="#e8c668" /></radialGradient>
        </defs>
        {rimShadow(id, 180)}
        <circle cx="180" cy="176" r="164" fill={`url(#${id}t)`} />
        {Array.from({ length: 36 }).map((_, i) => (<circle key={i} cx={180 + Math.cos(i / 36 * 6.283) * 158} cy={176 + Math.sin(i / 36 * 6.283) * 158} r="8" fill="#c9a263" />))}
        <circle cx="180" cy="176" r="138" fill={`url(#${id}f)`} />
        {[[180, 176], [130, 130], [230, 130], [130, 226], [230, 226], [180, 110], [180, 244]].map(([x, y], i) => (
          <g key={i}><circle cx={x} cy={y} r="26" fill="#b3172e" /><circle cx={x - 8} cy={y - 8} r="8" fill="#fff" opacity=".35" /></g>
        ))}
      </>
    ),
  },
  pancakes: {
    w: 360, h: 360,
    render: (id) => (
      <>
        <defs>
          <radialGradient id={`${id}p`} cx=".35" cy=".3"><stop offset="0" stopColor="#e9b869" /><stop offset="1" stopColor="#b17a33" /></radialGradient>
        </defs>
        {rimShadow(id, 180)}
        <circle cx="180" cy="176" r="162" fill="#f1ede4" />
        <circle cx="180" cy="176" r="136" fill={`url(#${id}p)`} />
        <path d="M110 150 Q180 110 250 156 Q240 230 180 240 Q110 230 110 150 Z" fill="#6b3a1d" opacity=".9" />
        <rect x="150" y="150" width="60" height="40" rx="8" fill="#fbe7a1" />
        <rect x="156" y="154" width="22" height="10" rx="4" fill="#fff" opacity=".5" />
        {[[112, 210], [250, 112], [248, 240]].map(([x, y], i) => (<g key={i}><circle cx={x} cy={y} r="16" fill="#3b4d9a" /><circle cx={x - 5} cy={y - 5} r="5" fill="#fff" opacity=".4" /></g>))}
      </>
    ),
  },
  burger: {
    w: 360, h: 360,
    render: (id) => (
      <>
        <defs>
          <radialGradient id={`${id}b`} cx=".35" cy=".3"><stop offset="0" stopColor="#e9a458" /><stop offset="1" stopColor="#a8622a" /></radialGradient>
        </defs>
        {rimShadow(id, 180)}
        <circle cx="180" cy="176" r="164" fill={`url(#${id}b)`} />
        {Array.from({ length: 28 }).map((_, i) => (<ellipse key={i} cx={180 + Math.cos(i * 2.2) * (20 + (i * 17) % 100)} cy={176 + Math.sin(i * 2.2) * (20 + (i * 17) % 100)} rx="6" ry="3" fill="#f6e9cf" transform={`rotate(${i * 35} ${180 + Math.cos(i * 2.2) * (20 + (i * 17) % 100)} ${176 + Math.sin(i * 2.2) * (20 + (i * 17) % 100)})`} />))}
        <path d="M60 120 Q180 20 300 120" stroke="#fff" strokeOpacity=".3" strokeWidth="8" fill="none" strokeLinecap="round" />
      </>
    ),
  },
}

export function Art({ dish, className, style }: { dish: Dish; className?: string; style?: CSSProperties }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox={`0 0 ${dish.w} ${dish.h}`} className={className} style={style} role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {dish.render(id)}
    </svg>
  )
}

/* Ingredient pieces for Ingredient Universe. All 120x120, same light direction. */
export const Ingredient = ({ kind }: { kind: string }) => {
  const id = useId().replace(/:/g, '')
  const body: Record<string, ReactElement> = {
    beans: (
      <>
        <defs><radialGradient id={`${id}a`} cx=".3" cy=".25"><stop offset="0" stopColor="#8a5a3a" /><stop offset="1" stopColor="#2b160c" /></radialGradient></defs>
        {[[40, 70, -30], [78, 52, 25], [72, 92, 70]].map(([x, y, r], i) => (
          <g key={i} transform={`rotate(${r} ${x} ${y})`}><ellipse cx={x} cy={y} rx="26" ry="17" fill={`url(#${id}a)`} /><path d={`M${x - 24} ${y} Q${x} ${y - 9} ${x + 24} ${y}`} stroke="#140a05" strokeWidth="3" fill="none" /><ellipse cx={x - 8} cy={y - 7} rx="8" ry="3" fill="#fff" opacity=".25" /></g>
        ))}
      </>
    ),
    milk: (
      <>
        <defs><linearGradient id={`${id}a`} x1="0" x2="1"><stop offset="0" stopColor="#d8d2c6" /><stop offset=".5" stopColor="#fffdf6" /><stop offset="1" stopColor="#bdb6a6" /></linearGradient></defs>
        <path d="M44 22 h32 l8 20 v62 q0 6 -6 6 h-36 q-6 0 -6 -6 v-62 z" fill={`url(#${id}a)`} />
        <path d="M44 22 h32 l8 20 h-48 z" fill="#8fb3d9" opacity=".9" />
        <rect x="42" y="58" width="36" height="26" rx="3" fill="#2f4d7e" opacity=".85" />
        <path d="M48 28 L50 100" stroke="#fff" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
    chocolate: (
      <>
        <defs><linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6b4234" /><stop offset="1" stopColor="#24110a" /></linearGradient></defs>
        <g transform="rotate(-14 60 60)">
          <rect x="22" y="30" width="76" height="60" rx="4" fill={`url(#${id}a)`} />
          {[0, 1, 2].map((c) => [0, 1].map((r) => (
            <g key={`${c}${r}`}><rect x={26 + c * 23} y={34 + r * 27} width="20" height="24" rx="2" fill="#3a1d12" /><path d={`M${26 + c * 23} ${34 + r * 27} l20 0 l-6 8 l-14 0 z`} fill="#7d5040" opacity=".7" /></g>
          )))}
        </g>
      </>
    ),
    ice: (
      <>
        {[[34, 50, -12], [70, 40, 18], [58, 82, 6]].map(([x, y, r], i) => (
          <g key={i} transform={`rotate(${r} ${x} ${y})`}>
            <rect x={x} y={y} width="38" height="38" rx="8" fill="#d6efff" opacity=".5" />
            <rect x={x} y={y} width="38" height="38" rx="8" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="2" />
            <path d={`M${x + 6} ${y + 8} L${x + 18} ${y + 6}`} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </g>
        ))}
      </>
    ),
  }
  return <svg viewBox="0 0 120 120" aria-hidden="true">{body[kind]}</svg>
}
