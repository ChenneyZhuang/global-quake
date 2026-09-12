/**
 * Live data-source smoke tests.
 *
 * Run with: npm run test:network
 *
 * These hit the real public endpoints. They are separated from the unit suite
 * because they need network access and can fail for reasons outside this
 * project's control (upstream outage), so they are not part of `npm test`.
 *
 * The point is to catch the failure mode this project already hit twice:
 * a source that silently returns nothing (GFZ rejecting format=geojson) while
 * the UI keeps listing it as active.
 */
const TIMEOUT_MS = 25_000

let passed = 0
let failed = 0

async function check(name, fn) {
  const started = Date.now()
  try {
    const note = await fn()
    passed++
    console.log(`  ✓ ${name} — ${note} [${Date.now() - started}ms]`)
  } catch (err) {
    failed++
    console.log(`  ✗ ${name} — ${err.message} [${Date.now() - started}ms]`)
  }
}

const get = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}
const getJson = async (url) => (await get(url)).json()

console.log('Live data-source smoke tests\n')

console.log('USGS (global catalogue)')
await check('all_hour feed returns features', async () => {
  const d = await getJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson')
  const n = d.features?.length ?? 0
  if (!n) throw new Error('zero features')
  return `${n} events`
})
await check('4.5_week feed is M4.5+ only', async () => {
  const d = await getJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson')
  const mags = d.features.map(f => f.properties.mag)
  const below = mags.filter(m => m < 4.5).length
  if (below) throw new Error(`${below} events below M4.5`)
  return `${mags.length} events, all >= M4.5`
})
await check('supports conditional requests (If-Modified-Since -> 304)', async () => {
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
  const first = await get(url)
  const stamp = first.headers.get('Last-Modified')
  if (!stamp) throw new Error('no Last-Modified header')
  const second = await fetch(url, { headers: { 'If-Modified-Since': stamp } })
  if (second.status !== 304) throw new Error(`expected 304, got ${second.status}`)
  return 'revalidation costs 0 bytes'
})

console.log('\nEMSC (European-Mediterranean)')
await check('format=json works', async () => {
  const d = await getJson('https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=10&minmag=2.5&orderby=time')
  const n = d.features?.length ?? 0
  if (!n) throw new Error('zero features')
  return `${n} events`
})
await check('format=geojson is rejected (documents why we use json)', async () => {
  const res = await fetch('https://www.seismicportal.eu/fdsnws/event/1/query?format=geojson&limit=5', {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = await res.text()
  if (!/unknown format|Error 4\d\d/i.test(body)) throw new Error('expected an error payload')
  return 'rejected as expected'
})

console.log('\nGFZ/GEOFON')
await check('format=text works (the only format it accepts)', async () => {
  const res = await get('https://geofon.gfz-potsdam.de/fdsnws/event/1/query?format=text&limit=10&minmag=2.5&orderby=time')
  const text = await res.text()
  const rows = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')).length
  if (!rows) throw new Error('no data rows')
  return `${rows} rows`
})
await check('format=geojson is rejected (the bug that hid this source)', async () => {
  const res = await fetch('https://geofon.gfz-potsdam.de/fdsnws/event/1/query?format=geojson&limit=5', {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = await res.text()
  if (!/invalid value in parameter/i.test(body)) throw new Error('expected a format error')
  return 'rejected as expected'
})

console.log('\nGeoNet (New Zealand)')
await check('quake endpoint returns features', async () => {
  const d = await getJson('https://api.geonet.org.nz/quake?MMI=0')
  const n = d.features?.length ?? 0
  if (!n) throw new Error('zero features')
  return `${n} events`
})

console.log('\nP2PQuake / JMA (Japan)')
await check('history endpoint returns code 551 bulletins', async () => {
  const d = await getJson('https://api.p2pquake.net/v2/history?codes=551&limit=20')
  const n = d.filter(m => m.code === 551).length
  if (!n) throw new Error('no 551 messages')
  return `${n} bulletins`
})
await check('551 messages carry hypocenter.magnitude (not earthquake.magnitude)', async () => {
  const d = await getJson('https://api.p2pquake.net/v2/history?codes=551&limit=20')
  for (const m of d) {
    const eq = m.earthquake
    if (!eq?.hypocenter) continue
    if (eq.magnitude !== undefined && eq.hypocenter.magnitude === undefined) {
      throw new Error('magnitude found only at the wrong path')
    }
    return `mag at hypocenter.magnitude (maxScale=${eq.maxScale})`
  }
  throw new Error('no usable bulletin')
})
await check('early-warning code 556 shape is understood', async () => {
  const d = await getJson('https://api.p2pquake.net/v2/history?codes=556&limit=5')
  if (!d.length) return 'no recent EEW bulletins (quiet period) — shape unchecked'
  const m = d[0]
  for (const key of ['areas', 'earthquake', 'cancelled']) {
    if (!(key in m)) throw new Error(`556 payload missing "${key}"`)
  }
  return `${m.areas?.length ?? 0} areas in latest bulletin`
})

console.log(`\n${'─'.repeat(50)}`)
console.log(`${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
console.log('All live sources healthy.')
