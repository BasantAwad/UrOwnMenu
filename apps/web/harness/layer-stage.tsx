/**
 * LayerStage harness: renders one item's real pipeline output with no API and
 * no database, so the visual check (build spec 10.4) can be run from a
 * screenshot.
 *
 *   /harness/layer-stage.html?item=pipeline-out/verify-run/item_0142&stage=desktop
 *
 * Reads `analysis.json`, `layers.<stage>.json` and every `assets/*.meta.json`
 * from `item`, so the picture is exactly what the pipeline wrote.
 */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { ItemAnalysis, LayerPlan } from '../src/pipeline/contracts'
import { RULES } from '../src/pipeline/rules'
import { LayerStage, type StageAsset } from '../src/pipeline/LayerStage'
import '../src/pipeline/layer-stage.css'

const query = new URLSearchParams(location.search)
const rawItem = query.get('item') || 'pipeline-out/verify-run/item_0142'
const itemDir = (rawItem.startsWith('/') ? rawItem : `/${rawItem}`).replace(/\/$/, '')
const stageName = query.get('stage') === 'mobile' ? 'mobile' : 'desktop'

type Loaded = {
  analysis: ItemAnalysis
  plan: LayerPlan
  assets: Record<string, StageAsset>
}

type Sidecar = {
  gate: { ok: boolean; reasons: string[] }
  meta: { width: number; height: number }
}

async function load(): Promise<Loaded> {
  const [analysis, plan] = await Promise.all([
    fetch(`${itemDir}/analysis.json`).then((response) => response.json() as Promise<ItemAnalysis>),
    fetch(`${itemDir}/layers.${stageName}.json`).then((response) => response.json() as Promise<LayerPlan>),
  ])

  const assets: Record<string, StageAsset> = {}
  await Promise.all(
    plan.layers.map(async (layer) => {
      try {
        const sidecar = (await fetch(`${itemDir}/assets/${layer.assetId}.meta.json`).then((response) =>
          response.json(),
        )) as Sidecar
        assets[layer.assetId] = {
          src: `${itemDir}/assets/${layer.assetId}.png`,
          width: sidecar.meta.width,
          height: sidecar.meta.height,
          gate: sidecar.gate,
        }
      } catch {
        // A missing sidecar means no proof of a passed gate; the renderer skips it.
      }
    }),
  )

  return { analysis, plan, assets }
}

function Harness() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load().then(setLoaded, (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [])

  if (error) return <pre style={{ padding: 24, color: '#8a1c1c' }}>{error}</pre>
  if (!loaded) return null

  const { analysis, plan, assets } = loaded
  return (
    <main style={{ maxWidth: 1440, margin: '0 auto', background: '#f6f1e7' }}>
      <LayerStage
        plan={plan}
        assets={assets}
        stage={RULES.stages[stageName]}
        copy={
          <>
            <p className="layer-stage__eyebrow">{analysis.mood}</p>
            <h1 className="layer-stage__title">{analysis.item}</h1>
            <p className="layer-stage__ingredients">{analysis.ingredients.join(' · ')}</p>
          </>
        }
      />
      <div style={{ height: '60vh' }} />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Harness />)
