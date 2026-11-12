import * as React from 'react'
import * as THREE from 'three'

export type PlateSceneProps = {
  /** Optional photograph to project onto the plate. Falls back to a tinted disc. */
  textureUrl?: string
  /** Palette tint for the plate body. */
  tint?: string
  /** Reduced motion is honoured automatically via matchMedia. */
  className?: string
  onWebGLUnavailable?: () => void
}

/**
 * A small, self-contained 3D set piece: a plate that tilts with the pointer
 * and slowly turns, lit by a warm key light. It is the flagship 3D moment of
 * the Café template.
 *
 * It is deliberately tiny: one draw call for the plate, one for the rim, one
 * directional light. It must stay inside the site-check budget on a phone.
 */
export default function PlateScene({ textureUrl, tint, className, onWebGLUnavailable }: PlateSceneProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer | null = null
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch (e) {
      onWebGLUnavailable?.()
      return
    }
    if (!renderer.getContext()) {
      onWebGLUnavailable?.()
      renderer.dispose()
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 1.6, 4.2)
    camera.lookAt(0, 0.2, 0)

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(host.clientWidth || 320, host.clientHeight || 320, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    host.appendChild(renderer.domElement)
    ;(window as any).__app = { renderer }
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'

    // Lights.
    const ambient = new THREE.AmbientLight(0xfff4e6, 0.55)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffe6c8, 1.6)
    key.position.set(2.4, 3.6, 2.8)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 12
    key.shadow.camera.left = -3
    key.shadow.camera.right = 3
    key.shadow.camera.top = 3
    key.shadow.camera.bottom = -3
    scene.add(key)

    const group = new THREE.Group()
    scene.add(group)

    const plateColor = tint ? new THREE.Color(tint) : new THREE.Color(0xf4e6d2)
    const plateMat = new THREE.MeshStandardMaterial({
      color: plateColor,
      roughness: 0.38,
      metalness: 0.06,
    })
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.28, 0.12, 48), plateMat)
    plate.receiveShadow = true
    plate.castShadow = true
    group.add(plate)

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xe8d6b8,
      roughness: 0.28,
      metalness: 0.12,
    })
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.05, 16, 64), rimMat)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.06
    rim.castShadow = true
    group.add(rim)

    // Optional dish texture on a floating card above the plate.
    if (textureUrl) {
      const loader = new THREE.TextureLoader()
      loader.load(
        textureUrl,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
          const sprite = new THREE.Sprite(spriteMat)
          sprite.scale.set(1.5, 1.5, 1)
          sprite.position.set(0, 0.62, 0)
          group.add(sprite)
        },
        undefined,
        () => {
          // Texture failed to load; the plate still renders.
        },
      )
    }

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.62
    ground.receiveShadow = true
    scene.add(ground)

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let running = true

    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }

    function onPointerMove(e: PointerEvent) {
      const rect = host!.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width - 0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5
      target.x = ny * 0.6
      target.y = nx * 0.6
    }
    function onPointerLeave() {
      target.x = 0
      target.y = 0
    }
    host.addEventListener('pointermove', onPointerMove)
    host.addEventListener('pointerleave', onPointerLeave)

    function resize() {
      if (!host || !renderer) return
      const w = host.clientWidth || 320
      const h = host.clientHeight || 320
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(() => resize())
    if (host) ro.observe(host)

    function frame() {
      if (!running || !renderer) return
      // Smooth the pointer tilt.
      current.x += (target.x - current.x) * 0.08
      current.y += (target.y - current.y) * 0.08

      if (!reducedMotion) {
        group.rotation.y += 0.004
      }
      group.rotation.x = current.x
      group.rotation.z = -current.y

      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }

    setReady(true)
    if (reducedMotion) {
      // Single frame, no loop.
      group.rotation.x = 0
      group.rotation.z = 0
      renderer.render(scene, camera)
    } else {
      raf = requestAnimationFrame(frame)
    }

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerleave', onPointerLeave)
      renderer?.dispose()
      scene.traverse((obj) => {
        const m = (obj as THREE.Mesh).material
        if (m) {
          if (Array.isArray(m)) m.forEach((x) => x.dispose())
          else m.dispose()
        }
        const g = (obj as THREE.Mesh).geometry
        if (g) g.dispose()
      })
      if (renderer?.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
  }, [textureUrl, tint, onWebGLUnavailable])

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      aria-hidden="true"
      data-ready={ready ? 'true' : 'false'}
    />
  )
}
