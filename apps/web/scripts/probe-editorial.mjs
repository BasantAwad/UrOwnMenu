import { chromium } from 'playwright'

const url = process.argv[2] || 'http://localhost:5173/m/cairo-coffee-house'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

const report = await page.evaluate(() => {
  const pick = (el, keys) => {
    if (!el) return null
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const out = { rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }
    for (const k of keys) out[k] = cs[k]
    return out
  }

  const sigItems = Array.from(document.querySelectorAll('.tpl-editorial__signatureItem'))
  const sig = sigItems.map((item) => {
    const media = item.querySelector('.tpl-editorial__signatureMedia')
    const img = item.querySelector('img, svg')
    return {
      item: pick(item, ['gridColumn', 'display', 'flexDirection']),
      media: pick(media, ['background', 'aspectRatio', 'height', 'overflow']),
      img: img
        ? {
            tag: img.tagName,
            cls: img.getAttribute('class'),
            ...pick(img, ['objectFit', 'objectPosition', 'width', 'height']),
            natural: img.tagName === 'IMG' ? [img.naturalWidth, img.naturalHeight] : null,
          }
        : null,
    }
  })

  const itemsGrid = document.querySelector('.tpl-editorial__items')
  const firstItem = document.querySelector('.tpl-editorial__item')
  const chapters = Array.from(document.querySelectorAll('.tpl-editorial__chapter')).map((c) =>
    pick(c, ['backgroundColor', 'padding', 'display']),
  )

  return {
    sig,
    itemsGrid: pick(itemsGrid, ['display', 'gridTemplateColumns', 'gap']),
    firstItem: firstItem
      ? {
          ...pick(firstItem, ['display', 'gridTemplateColumns', 'gap']),
          children: Array.from(firstItem.children).map((c) => ({
            cls: c.getAttribute('class'),
            ...pick(c, ['gridColumn', 'fontSize']),
          })),
        }
      : null,
    chapters,
  }
})

console.log(JSON.stringify(report, null, 2))
await browser.close()
