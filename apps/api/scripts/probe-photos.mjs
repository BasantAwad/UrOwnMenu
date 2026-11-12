const UA = 'UrOwnMenu/1.0 (seed)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function searchCommons(query, limit = 6) {
  const searchUrl =
    'https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=' +
    encodeURIComponent(query) +
    '&srnamespace=6&srlimit=' + limit +
    '&format=json'
  const res = await fetch(searchUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { console.log('  rate-limited/bad response'); return }
  const hits = data?.query?.search ?? []
  for (const h of hits) {
    if (!h?.title) continue
    const infoUrl =
      'https://commons.wikimedia.org/w/api.php?action=query&titles=' +
      encodeURIComponent(h.title) +
      '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1400&format=json'
    try {
      const infoRes = await fetch(infoUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
      const infoText = await infoRes.text()
      const info = JSON.parse(infoText)
      const pages = info?.query?.pages ?? {}
      const page = Object.values(pages)[0]
      const ii = page?.imageinfo?.[0]
      if (!ii?.url) continue
      const w = ii.width ?? 0
      if (w < 1000) continue
      const meta = ii.extmetadata ?? {}
      const lic = meta.LicenseShortName?.value || '?'
      const artist = String(meta.Artist?.value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 30)
      console.log(`  ${w}x${ii.height ?? '?'}  ${lic.padEnd(10)} ${h.title.slice(0, 72)}  | ${artist}`)
    } catch (e) {
      console.log('  skip', h.title, String(e.message).slice(0, 60))
    }
    await sleep(900)
  }
}

const QUERIES = process.argv.slice(2)
for (const q of QUERIES) {
  console.log('\n### ' + q)
  await searchCommons(q)
  await sleep(1500)
}
