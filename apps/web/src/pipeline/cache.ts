/**
 * Canonical cache payloads (build spec section 9.3). The runner hashes these
 * with SHA-256; keeping the payloads pure means a browser build can reuse the
 * same keys for its own cache one day.
 */

export function downloadKeyPayload(sourceId: string, url: string): string {
  return `${sourceId}|${url}`
}

export function matteKeyPayload(inputSha256: string, mattingModelId: string): string {
  return `${inputSha256}|${mattingModelId}`
}

export function generateKeyPayload(
  prompt: string,
  genModelId: string,
  seed: number,
  width: number,
  height: number,
): string {
  return `${prompt}|${genModelId}|${seed}|${width}x${height}`
}

export function modelKeyPayload(
  kind: 'analyst' | 'art-dir' | 'critic',
  inputJson: string,
  modelId: string,
  promptVersion: string,
): string {
  return `${kind}|${inputJson}|${modelId}|${promptVersion}`
}

export function criticKeyPayload(pngSha256: string, promptVersion: string, criticModelId: string): string {
  return `${pngSha256}|${promptVersion}|${criticModelId}`
}
