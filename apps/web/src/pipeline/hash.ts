/**
 * FNV-1a 32-bit hash. Seeds the planner and every generation call, so a rerun
 * with the same item and brief lands on the same arrangement and the same
 * candidate images (docs/PIPELINE_BUILD_SPEC.md section 9.1).
 */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Hex form, handy for file names and logs. */
export function fnv1a32Hex(s: string): string {
  return fnv1a32(s).toString(16).padStart(8, '0')
}
