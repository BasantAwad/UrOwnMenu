import * as React from 'react'
import {
  CUTOUT_MODELS,
  DEFAULT_ADJUSTMENTS,
  computeCropRect,
  inspectImageFile,
  prepareForUpload,
  prepareImage,
  readFileAsDataUrl,
  type Adjustments,
  type BackgroundRemovalProgress,
  type CutoutModel,
} from './media'
import type { PhotoMeta } from './media-intelligence'
type Props = {
  file: File
  onCancel: () => void
  onApply: (result: {
    dataUrl: string
    filename: string
    width: number
    height: number
    cutout: boolean
    meta?: PhotoMeta
  }) => void
}

const ASPECT_PRESETS: Array<{ label: string; ratio: number | null }> = [
  { label: 'Original', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '4:5', ratio: 4 / 5 },
]

/**
 * Media preparation dialog.
 *
 * Deterministic controls are applied live in the browser. ONNX background
 * removal is opt-in, loads the model only when requested, and reports
 * progress so the owner can cancel.
 */
export default function MediaEditor({ file, onCancel, onApply }: Props) {
  const [adjustments, setAdjustments] = React.useState<Adjustments>(DEFAULT_ADJUSTMENTS)
  const [sourceUrl, setSourceUrl] = React.useState<string>('')
  const [previewUrl, setPreviewUrl] = React.useState<string>('')
  const [natural, setNatural] = React.useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [removing, setRemoving] = React.useState(false)
  const [progress, setProgress] = React.useState<{ stage: string; percent: number } | null>(null)
  const [cutout, setCutout] = React.useState(false)
  const [cutoutModel, setCutoutModel] = React.useState<CutoutModel>(CUTOUT_MODELS[0])
  const [showOriginal, setShowOriginal] = React.useState(false)
  const [preparedMeta, setPreparedMeta] = React.useState<PhotoMeta | null>(null)

  // Load the original once.
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const inspection = await inspectImageFile(file)
      if (cancelled) return
      if (!inspection.ok) {
        setError(inspection.error || 'That file cannot be used.')
        return
      }
      setNatural({ width: inspection.width, height: inspection.height })
      const url = await readFileAsDataUrl(file)
      if (!cancelled) setSourceUrl(url)
    })()
    return () => {
      cancelled = true
    }
  }, [file])

  // Re-render the preview whenever adjustments change.
  React.useEffect(() => {
    if (!sourceUrl) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const result = await prepareImage(sourceUrl, adjustments, 900)
        if (!cancelled) {
          setPreviewUrl(result.dataUrl)
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sourceUrl, adjustments])

  const update = (patch: Partial<Adjustments>) => {
    setAdjustments((prev) => ({ ...prev, ...patch }))
  }

  const cropRect = natural.width
    ? computeCropRect(natural.width, natural.height, adjustments.aspectRatio, adjustments.focusX, adjustments.focusY)
    : null

  async function handleRemoveBackground() {
    setRemoving(true)
    setProgress({ stage: 'Preparing…', percent: 5 })
    try {
      const onProgress: BackgroundRemovalProgress = (stage, percent) => {
        setProgress({ stage, percent })
      }
      const result = await prepareForUpload(file, adjustments, {
        removeBackground: true,
        cutoutModel,
        onProgress,
      })
      setPreviewUrl(result.dataUrl)
      setCutout(result.cutout)
      setPreparedMeta(result.meta)
    } catch (e) {
      setError('Background removal is unavailable right now. Your photo was left unchanged.')
      console.error(e)
    } finally {
      setRemoving(false)
      setProgress(null)
    }
  }

  async function handleApply() {
    setBusy(true)
    try {
      const result = await prepareForUpload(file, adjustments, {
        removeBackground: cutout,
        cutoutModel,
      })
      onApply({
        dataUrl: result.dataUrl,
        filename: result.filename,
        width: result.width,
        height: result.height,
        cutout: result.cutout,
        meta: result.meta,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const previewRatio = cutout && preparedMeta ? preparedMeta.ratio : null
  const cropStyle: React.CSSProperties = previewRatio
    ? { aspectRatio: String(previewRatio), maxWidth: '100%' }
    : cropRect && natural.width
      ? {
          aspectRatio: String(cropRect.width / cropRect.height),
          maxWidth: '100%',
        }
      : {}

  return (
    <div className="mediaEditor" role="dialog" aria-modal="true" aria-label="Prepare photo">
      <div className="mediaEditor__panel">
        <header className="mediaEditor__header">
          <h2 className="mediaEditor__title">Prepare photo</h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} aria-label="Close">
            Close
          </button>
        </header>

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <div className="mediaEditor__body">
          <div className="mediaEditor__stage">
            <div className="mediaEditor__canvas" style={cropStyle}>
              {(showOriginal ? sourceUrl : previewUrl) && (
                <img
                  src={showOriginal ? sourceUrl : previewUrl}
                  alt="Photo preview"
                  className={cutout && !showOriginal ? 'is-cutout' : ''}
                />
              )}
              {!previewUrl && !sourceUrl && <div className="mediaEditor__placeholder">Loading…</div>}
            </div>

            <div className="mediaEditor__stageBar">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onMouseDown={() => setShowOriginal(true)}
                onMouseUp={() => setShowOriginal(false)}
                onMouseLeave={() => setShowOriginal(false)}
                onTouchStart={() => setShowOriginal(true)}
                onTouchEnd={() => setShowOriginal(false)}
              >
                Hold to compare original
              </button>
              {natural.width > 0 && (
                <span className="mediaEditor__dims">
                  {natural.width}×{natural.height}
                  {cropRect && cropRect.width !== natural.width && (
                    ' → ' + cropRect.width + '×' + cropRect.height
                  )}
                </span>
              )}
            </div>

            {progress && (
              <div className="mediaEditor__progress" role="status">
                <div className="mediaEditor__progressBar">
                  <span style={{ width: progress.percent + '%' }} />
                </div>
                <span className="mediaEditor__progressText">
                  {progress.stage} ({progress.percent}%)
                </span>
              </div>
            )}
          </div>

          <div className="mediaEditor__controls">
            <section className="mediaEditor__group">
              <h3 className="mediaEditor__groupTitle">Framing</h3>
              <div className="mediaEditor__chips">
                {ASPECT_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.label}
                    className={'tplChip' + (adjustments.aspectRatio === preset.ratio ? ' is-active' : '')}
                    onClick={() => update({ aspectRatio: preset.ratio })}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {adjustments.aspectRatio !== null && (
                <div className="mediaEditor__sliders">
                  <label className="mediaEditor__slider">
                    <span>Subject left/right</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={adjustments.focusX}
                      onChange={(e) => update({ focusX: Number(e.target.value) })}
                    />
                  </label>
                  <label className="mediaEditor__slider">
                    <span>Subject up/down</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={adjustments.focusY}
                      onChange={(e) => update({ focusY: Number(e.target.value) })}
                    />
                  </label>
                </div>
              )}
            </section>

            <section className="mediaEditor__group">
              <h3 className="mediaEditor__groupTitle">Light &amp; colour</h3>
              <label className="mediaEditor__slider">
                <span>Exposure <em>{adjustments.exposure.toFixed(2)}×</em></span>
                <input
                  type="range"
                  min={0.7}
                  max={1.4}
                  step={0.01}
                  value={adjustments.exposure}
                  onChange={(e) => update({ exposure: Number(e.target.value) })}
                />
              </label>
              <label className="mediaEditor__slider">
                <span>Contrast <em>{adjustments.contrast.toFixed(2)}×</em></span>
                <input
                  type="range"
                  min={0.7}
                  max={1.4}
                  step={0.01}
                  value={adjustments.contrast}
                  onChange={(e) => update({ contrast: Number(e.target.value) })}
                />
              </label>
              <label className="mediaEditor__slider">
                <span>Saturation <em>{adjustments.saturation.toFixed(2)}×</em></span>
                <input
                  type="range"
                  min={0}
                  max={1.6}
                  step={0.01}
                  value={adjustments.saturation}
                  onChange={(e) => update({ saturation: Number(e.target.value) })}
                />
              </label>
              <label className="mediaEditor__slider">
                <span>Warmth <em>{adjustments.temperature > 0 ? '+' : ''}{adjustments.temperature.toFixed(2)}</em></span>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={adjustments.temperature}
                  onChange={(e) => update({ temperature: Number(e.target.value) })}
                />
              </label>
              <label className="mediaEditor__slider">
                <span>Sharpening <em>{Math.round(adjustments.sharpen * 100)}%</em></span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={adjustments.sharpen}
                  onChange={(e) => update({ sharpen: Number(e.target.value) })}
                />
              </label>
            </section>

            <section className="mediaEditor__group">
              <h3 className="mediaEditor__groupTitle">Background</h3>
              <p className="mediaEditor__hint">
                Background removal runs entirely in your browser using an open-source model.
                The model downloads only when you ask for it, and your photo is never sent
                to a third-party service. The subject is then trimmed to its edges,
                optically centred and padded to a square frame, so it cannot keep the
                empty margin of the original photograph.
              </p>

              {cutout && preparedMeta && (
                <p className="mediaEditor__hint mediaEditor__hint--good" role="status">
                  Reframed: the subject fills {Math.round(preparedMeta.coverage * 100)}% of
                  the new frame and sits at its centre. Every template can now place it
                  without a white box.
                </p>
              )}

              <div className="mediaEditor__models">
                {CUTOUT_MODELS.map((model) => (
                  <button
                    type="button"
                    key={model.key}
                    className={'modelCard' + (cutoutModel.key === model.key ? ' is-active' : '')}
                    onClick={() => setCutoutModel(model)}
                    aria-pressed={cutoutModel.key === model.key}
                    disabled={removing || busy}
                  >
                    <span className="modelCard__label">{model.label}</span>
                    <span className="modelCard__blurb">{model.blurb}</span>
                    <span className="modelCard__meta">
                      ~{model.sizeMb} MB download · {model.license} · {model.bestFor}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleRemoveBackground}
                disabled={removing || busy}
              >
                {removing ? 'Removing background…' : cutout ? 'Background removed ✓' : 'Remove background'}
              </button>
            </section>
          </div>
        </div>

        <footer className="mediaEditor__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleApply} disabled={busy || !previewUrl}>
            {busy ? 'Applying…' : 'Use this photo'}
          </button>
        </footer>
      </div>
    </div>
  )
}
