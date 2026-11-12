const UA = 'UrOwnMenu/1.0 (seed)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function summary(title) {
  const url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'))
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) {
    console.log('  HTTP', res.status)
    return null
  }
  return res.json()
}

async function fileInfo(fileName) {
  // Licence info for a Commons file, via the public MediaWiki API.
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&titles=' +
    encodeURIComponent(fileName.startsWith('File:') ? fileName : 'File:' + fileName) +
    '&prop=imageinfo&iiprop=extmetadata|size|url&iiurlwidth=1400&format=json'
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) return null
  const data = await res.json()
  const pages = data?.query?.pages ?? {}
  const page = Object.values(pages)[0]
  return page?.imageinfo?.[0] ?? null
}

const TITLES = process.argv.slice(2)
for (const t of TITLES) {
  console.log('\n### ' + t)
  const s = await summary(t)
  await sleep(800)
  if (!s) continue
  const file = s?.originalimage?.source || s?.thumbnail?.source
  if (!file) {
    console.log('  no image')
    continue
  }
  console.log('  article:', s.title)
  console.log('  image:', file)
  console.log('  size:', s?.originalimage?.width ?? '?', 'x', s?.originalimage?.height ?? '?')
  // Extract "File:..." from the upload.wikimedia.org path
  const m = /\/commons\/([a-f0-9]\/[a-f0-9]{2}\/[^/]+)$/.exec(file)
  if (m) {
    const info = await fileInfo(decodeURIComponent('File:' + m[1].split('/').pop()))
    await sleep(800)
    if (info) {
      const meta = info.extmetadata ?? {}
      const lic = meta.LicenseShortName?.value || '?'
      const artist = String(meta.Artist?.value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 32)
      console.log('  license:', lic, '| by:', artist)
    }
  }
}
