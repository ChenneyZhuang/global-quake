/**
 * Global earthquake data sources & visualization helpers.
 *
 * Data source architecture inspired by:
 *   - kanameishi (multi-source aggregation: USGS + Wolfx + P2PQuake + FAN Studio)
 *   - GlobalQuake (SeedLink + FDSNWS for real-time station data)
 *   - OpenEEW (open-source EEW sensor network concept)
 *
 * Color scales inspired by:
 *   - JQuake / GlobalQuake (magnitude: green→yellow→orange→red→purple)
 *   - TREM-Lite / Zero-Quake (intensity: blue→green→yellow→orange→red)
 *   - kanameishi (depth: red shallow → blue deep)
 *
 * Markers: CircleMarker radius ∝ mag^2 (JQuake / TREM-Lite)
 *
 * Data source references:
 *   - USGS GeoJSON Feed: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 *   - EMSC FDSNWS: https://www.seismicportal.eu/fdsnws/event/1/
 *   - P2PQuake JSON API v2: https://www.p2pquake.net/develop/json_api_v2/
 *   - GFZ FDSNWS: https://geofon.gfz-potsdam.de/fdsnws/event/1/
 *   - GeoNet Quake API: https://api.geonet.org.nz/
 *   - ISC FDSNWS: http://www.isc.ac.uk/fdsnws/event/1/
 *   - EarthquakeDataCenters list: https://github.com/YacineBoussoufa/EarthquakeDataCenters
 */

// --- USGS Earthquake Hazards Program (public domain, no API key) ---
// Docs: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
const USGS_BASE = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary'

export const USGS_FEEDS = {
  all_hour: `${USGS_BASE}/all_hour.geojson`,       // M1.0+, past hour
  all_day: `${USGS_BASE}/all_day.geojson`,           // M1.0+, past day
  all_week: `${USGS_BASE}/all_week.geojson`,         // M1.0+, past week
  '2.5_day': `${USGS_BASE}/2.5_day.geojson`,        // M2.5+, past day
  '2.5_week': `${USGS_BASE}/2.5_week.geojson`,      // M2.5+, past week
  '4.5_week': `${USGS_BASE}/4.5_week.geojson`,      // M4.5+, past week
  significant_month: `${USGS_BASE}/significant_month.geojson`, // Significant, past 30 days
}

// --- EMSC (European-Mediterranean Seismological Centre) ---
// Free FDSN event API: https://www.seismicportal.eu/fdsnws/event/1/
// format=json returns a GeoJSON FeatureCollection — EMSC does NOT support
// format=geojson (it answers "unknown format requested").
const EMSC_BASE = 'https://www.seismicportal.eu/fdsnws/event/1/query'

// --- GFZ/GEOFON (German Research Centre for Geosciences) ---
// Free FDSN event API. NOTE: GFZ's FDSNWS event service does NOT support
// format=json or format=geojson — both return "Error 400: invalid value in
// parameter: format". Only text / csv / xml work, so we request the pipe-
// delimited text table and parse it client-side.
const GFZ_BASE = 'https://geofon.gfz-potsdam.de/fdsnws/event/1/query'

// --- GeoNet New Zealand ---
// Free GeoJSON earthquake endpoint. We filter the time window client-side.
const GEONET_QUAKE = 'https://api.geonet.org.nz/quake'

/**
 * Build EMSC FDSN query URL.
 * @param {Object} opts
 * @param {number} [opts.limit=200]
 * @param {number} [opts.minmag=2.5]
 * @param {string} [opts.start] - ISO datetime string
 * @returns {string}
 */
export function emscUrl(opts = {}) {
  const limit = opts.limit || 200
  const minmag = opts.minmag || 2.5
  const params = new URLSearchParams({
    format: 'json',
    limit: String(limit),
    minmag: String(minmag),
    orderby: 'time',
  })
  if (opts.start) params.set('start', opts.start)
  return `${EMSC_BASE}?${params}`
}

/**
 * Build GFZ FDSN query URL. Uses format=text because GFZ rejects json/geojson.
 */
export function gfzTextUrl(opts = {}) {
  const params = new URLSearchParams({
    format: 'text',
    limit: String(opts.limit || 200),
    minmag: String(opts.minmag || 2.5),
    orderby: 'time',
  })
  if (opts.start) params.set('starttime', opts.start)
  if (opts.end) params.set('endtime', opts.end)
  return `${GFZ_BASE}?${params}`
}

/**
 * Parse the GFZ FDSN text table (pipe-delimited, header row prefixed with #)
 * into GeoJSON-like features so normalizeEvent() can treat them like any other
 * source.
 *
 * Real payload:
 *   #EventID|Time|Latitude|Longitude|Depth/km|Author|Catalog|Contributor|...
 *   gfz2026rsyb|2026-09-10T06:42:41.37|-3.888|-77.561|10.0|||GFZ|...|Mw|5.29||Peru-Ecuador Border Region|earthquake
 */
export function parseGfzText(text) {
  const lines = String(text || '').split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'))
  const features = []
  for (const line of lines) {
    const cols = line.split('|')
    if (cols.length < 14) continue
    const lat = Number(cols[2])
    const lng = Number(cols[3])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    features.push({
      type: 'feature',
      id: cols[0] || null,
      geometry: {
        type: 'Point',
        coordinates: [lng, lat, Number(cols[4]) || 0],
      },
      properties: {
        mag: Number(cols[10]) || null,
        magtype: cols[9] || null,
        place: cols[12] || 'GFZ event',
        time: cols[1] || null,
        type: cols[13] || 'earthquake',
        // GEOFON has no readable per-event web page (eventinfo.php 404s),
        // so the FDSN eventid query is the closest per-event link.
        url: cols[0] ? `${GFZ_BASE}?eventid=${encodeURIComponent(cols[0])}&format=text` : null,
      },
    })
  }
  return features
}

// --- P2PQuake (Japanese community, free) ---
// WebSocket for JMA earthquake/tsunami info
// Docs: https://www.p2pquake.net/develop/json_api_v2/
export const P2PQUAKE_WS = 'wss://api.p2pquake.net/v2/ws'
export const P2PQUAKE_HISTORY = 'https://api.p2pquake.net/v2/history'

// P2PQuake message codes we consume. 551 is the hypocentre bulletin;
// 556 is the (non-certified) earthquake early-warning bulletin and carries a
// per-prefecture intensity/arrival-time table, which 551 does not.
export const P2P_QUAKE_MSG = {
  EARTHQUAKE: 551,
  EARLY_WARNING: 556,
}

/**
 * Convert a JMA intensity scale (0, 10, 20, 30, 35, 40, 45, 50, 55, 60, 65)
 * into an English label plus the legacy MMI mapping used elsewhere in the app.
 *
 * The old implementation did `ceil(scale / 10)`, which collapsed 25/30/35
 * into the same "3" and threw away the JMA half-steps (弱, やや強い,
 * かなり強い, 激しく) — the distinction that actually matters for shaking.
 * @param {number|null} scale - JMA scale value, e.g. 30 or 50
 * @returns {{ mmi: number|null, label: string }}
 */
export function jmaScaleToIntensity(scale) {
  if (scale == null || scale < 0 || Number.isNaN(Number(scale))) return { mmi: null, label: '' }
  const s = Number(scale)
  const table = [
    { max: 14, label: 'Barely felt', mmi: 2 },
    { max: 19, label: 'Weak', mmi: 3 },
    { max: 24, label: 'Barely strong', mmi: 3 },
    { max: 29, label: 'Weakly strong', mmi: 3 },
    { max: 34, label: 'Quite strong', mmi: 4 },
    { max: 39, label: 'Strong', mmi: 4 },
    { max: 44, label: 'Very strong', mmi: 5 },
    { max: 49, label: 'Very strong', mmi: 5 },
    { max: 54, label: 'Fiercely strong', mmi: 6 },
    { max: 59, label: 'Fiercely strong', mmi: 6 },
    { max: 64, label: 'Violently strong', mmi: 7 },
  ]
  for (const entry of table) {
    if (s <= entry.max) return { mmi: entry.mmi, label: entry.label }
  }
  return { mmi: 8, label: 'Violently strong' }
}

// --- Data fetcher ---

// Reference catalogs occasionally accept a connection and then never answer.
// Without a timeout the request never settles, `loadingData` stays true and the
// status bar is stuck on "Loading" indefinitely (verified: a black-hole server
// kept a bare fetch pending past 40 s). Every request gets a hard deadline.
const REQUEST_TIMEOUT_MS = 20_000

/**
 * fetch() with a hard timeout.
 *
 * Uses AbortSignal.timeout when available (Chrome 103+, Safari 16+, FF 100+)
 * and falls back to an AbortController + setTimeout for older engines.
 *
 * @param {string} url
 * @param {Object} [options] - usual fetch init; `timeoutMs` overrides the default
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...init } = options
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// USGS sends `Last-Modified` and answers 304 with an empty body when we echo it
// back. Verified: all_week is 1.5 MB, but a conditional request costs 0 bytes.
// We keep the last value per URL so repeat polls of an unchanged feed are free.
const lastModifiedByUrl = new Map()

/**
 * Conditionally fetch a JSON resource.
 *
 * @param {string} url
 * @returns {Promise<{ data: any|null, notModified: boolean }>} `data` is null
 *   when the server answered 304 and the caller should reuse its own copy.
 */
export async function fetchJsonConditional(url, options = {}) {
  const headers = {}
  const previous = lastModifiedByUrl.get(url)
  if (previous) headers['If-Modified-Since'] = previous

  const res = await fetchWithTimeout(url, { ...options, headers })
  if (res.status === 304) return { data: null, notModified: true }
  if (!res.ok) throw new Error(`${res.status}`)

  const stamp = res.headers.get('Last-Modified')
  if (stamp) lastModifiedByUrl.set(url, stamp)
  return { data: await res.json(), notModified: false }
}

/**
 * Retry a fetcher with exponential backoff and jitter.
 *
 * A transient 5xx/network blip previously dropped a whole source for a full
 * poll cycle. Retries are deliberately few and slow: these are public
 * fair-use endpoints, so hammering them on failure is worse than showing a
 * temporarily empty source.
 *
 * @param {() => Promise<any>} fn
 * @param {Object} [opts]
 * @param {number} [opts.attempts=3]
 * @param {number} [opts.baseDelayMs=800]
 * @returns {Promise<any>}
 */
export async function withRetry(fn, opts = {}) {
  const attempts = opts.attempts ?? 3
  const baseDelayMs = opts.baseDelayMs ?? 800
  let lastError
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === attempts - 1) break
      // Backoff, plus up to 40% jitter so several failing sources don't
      // retry in lockstep.
      const delay = baseDelayMs * 2 ** attempt * (1 + Math.random() * 0.4)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

/**
 * Fetch USGS GeoJSON feed. Uses a conditional request so an unchanged feed
 * costs a 304 instead of re-downloading up to 1.5 MB (all_week).
 * @param {string} feed - One of USGS_FEEDS keys or a raw URL
 * @param {Object} [opts]
 * @param {Object} [opts.cached] - Previously fetched FeatureCollection to reuse on 304
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function fetchUSGS(feed = 'all_day', opts = {}) {
  const url = USGS_FEEDS[feed] || feed
  const { data, notModified } = await fetchJsonConditional(url)
  if (notModified) {
    if (opts.cached) return opts.cached
    // No cached copy to fall back on: force a full fetch.
    const res = await fetchWithTimeout(url)
    if (!res.ok) throw new Error(`USGS ${res.status}`)
    return res.json()
  }
  return data
}

/**
 * Fetch EMSC events.
 * @param {Object} [opts]
 * @returns {Promise<Array>} Array of event objects
 */
export async function fetchEMSC(opts = {}) {
  const url = emscUrl(opts)
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`EMSC ${res.status}`)
  const data = await res.json()
  const features = data.features || []
  // EMSC does not return a public detail page per event (both
  // /event/{id} and emsc-csem.org/event/{id} return 404), but the FDSN
  // query endpoint accepts an eventid filter. That is the closest thing to
  // a per-event page, so we synthesise it — otherwise the popup's
  // "Source detail" link is silently missing for every EMSC event.
  return features.map(feature => {
    const id = feature.id || feature.properties?.event_id || feature.properties?.source_id
    return id
      ? { ...feature, properties: { ...feature.properties, url: `${EMSC_BASE}?eventid=${encodeURIComponent(id)}&format=text` } }
      : feature
  })
}

/**
 * Fetch GFZ/GEOFON events. GFZ rejects format=json and format=geojson, so we
 * request format=text and parse the pipe-delimited table.
 * @param {Object} [opts]
 * @returns {Promise<Array>} GeoJSON-like features
 */
export async function fetchGFZ(opts = {}) {
  const url = gfzTextUrl(opts)
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`GFZ ${res.status}`)
  const text = await res.text()
  if (/^Error\b/.test(text.trim())) {
    // FDSNWS answers "Error 400: ..." as plain text, not JSON.
    throw new Error(`GFZ ${text.trim().split('\n')[0].slice(0, 90)}`)
  }
  return parseGfzText(text)
}

export async function fetchGeoNet(opts = {}) {
  const params = new URLSearchParams({ MMI: '0' })
  const res = await fetchWithTimeout(`${GEONET_QUAKE}?${params}`)
  if (!res.ok) throw new Error(`GeoNet ${res.status}`)
  const data = await res.json()
  let features = data.features || []
  if (opts.start) {
    const start = new Date(opts.start).getTime()
    features = features.filter((feature) => {
      const t = new Date(feature.properties?.time).getTime()
      return Number.isFinite(t) && t >= start
    })
  }
  return features.slice(0, opts.limit || 200)
}

/**
 * Fetch P2PQuake history (JMA-coded earthquakes).
 * @param {number} [limit=10]
 * @returns {Promise<Array>}
 */
export async function fetchP2PQuakeHistory(limit = 10) {
  const url = `${P2PQUAKE_HISTORY}?codes=551&limit=${limit}`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`P2PQuake ${res.status}`)
  return res.json()
}

/**
 * Normalize different earthquake data formats to a common structure.
 * @param {Object} feature - GeoJSON feature from any source
 * @param {string} source - 'usgs' | 'emsc' | 'p2pquake'
 * @returns {Object} { id, lat, lng, mag, depth, place, time, url, source }
 */
export function normalizeEvent(feature, source = 'usgs') {
  if (source === 'usgs') {
    const p = feature.properties
    const c = feature.geometry.coordinates
    return {
      id: feature.id || p.ids,
      lat: c[1],
      lng: c[0],
      depth: c[2],
      mag: p.mag,
      place: p.place,
      time: p.time,
      updated: p.updated,
      url: p.url,
      detail: p.detail,
      felt: p.felt || null,
      cdi: p.cdi || null,
      mmi: p.mmi || null,
      alert: p.alert || null,
      tsunami: p.tsunami || 0,
      type: p.type,
      source: 'USGS',
    }
  }
  if (source === 'emsc') {
    const p = feature.properties
    const c = feature.geometry.coordinates
    return {
      id: p.event_id || feature.id,
      lat: c[1],
      lng: c[0],
      depth: Math.abs(c[2]),
      mag: p.mag,
      place: p.flynn_region || p.region,
      time: new Date(p.time).getTime(),
      updated: new Date(p.lastupdate).getTime(),
      url: p.url,
      detail: null,
      felt: p.felt || null,
      cdi: null,
      mmi: null,
      alert: null,
      tsunami: 0,
      type: p.type,
      source: 'EMSC',
    }
  }
  if (source === 'gfz') {
    const p = feature.properties || {}
    const c = feature.geometry?.coordinates || []
    return {
      id: feature.id || p.eventid || p.event_id || p.publicid,
      lat: c[1],
      lng: c[0],
      depth: Math.abs(c[2] ?? p.depth),
      mag: p.mag ?? p.magnitude,
      place: p.place || p.flynn_region || p.region || p.description || 'GFZ event',
      time: new Date(p.time).getTime(),
      updated: p.updated ? new Date(p.updated).getTime() : Date.now(),
      url: p.url || null,
      detail: null,
      felt: null,
      cdi: null,
      mmi: null,
      alert: null,
      tsunami: 0,
      type: p.type || 'earthquake',
      source: 'GFZ',
    }
  }
  if (source === 'geonet') {
    const p = feature.properties || {}
    const c = feature.geometry?.coordinates || []
    return {
      id: p.publicID || feature.id,
      lat: c[1],
      lng: c[0],
      depth: Math.abs(p.depth ?? c[2]),
      mag: p.magnitude,
      place: p.locality || 'New Zealand region',
      time: new Date(p.time).getTime(),
      updated: Date.now(),
      url: p.publicID ? `https://www.geonet.org.nz/earthquake/${p.publicID}` : null,
      detail: null,
      felt: null,
      cdi: null,
      mmi: p.mmi >= 0 ? p.mmi : null,
      alert: null,
      tsunami: 0,
      type: 'earthquake',
      source: 'GeoNet',
    }
  }
  // p2pquake format
  if (source === 'p2pquake') {
    const quake = feature.earthquake || feature
    const hypocenter = quake.hypocenter || feature
    return {
      id: feature.id || feature.code,
      lat: hypocenter.latitude ?? feature.lat,
      lng: hypocenter.longitude ?? feature.lng,
      depth: hypocenter.depth ?? feature.depth,
      mag: hypocenter.magnitude ?? quake.magnitude ?? feature.magnitude,
      place: hypocenter.name || feature.region || feature.name,
      time: quake.time ? new Date(quake.time).getTime() : (feature.time ? new Date(feature.time).getTime() : Date.now()),
      updated: Date.now(),
      url: null,
      detail: null,
      felt: null,
      cdi: null,
      mmi: null,
      alert: null,
      tsunami: 0,
      type: 'earthquake',
      source: 'P2PQuake/JMA',
    }
  }
  return feature
}

/**
 * Determine marker color by depth (km).
 * Uses a cool palette so depth does not compete with warm magnitude colors.
 * @param {number} depth - Depth in km
 * @returns {string} CSS color
 */
export function depthColor(depth) {
  if (depth == null || Number.isNaN(Number(depth))) return '#667085'
  if (depth < 0) return '#ff00ff'   // pink = unknown/error
  if (depth <= 10) return '#8ef6ff'  // cyan = very shallow
  if (depth <= 30) return '#37d4d8'
  if (depth <= 70) return '#2ea8ff'
  if (depth <= 150) return '#3476d8'
  if (depth <= 300) return '#5156b8'
  return '#6b4aa5'                   // violet = deep
}

/**
 * Determine marker radius by magnitude.
 * @param {number} mag
 * @returns {number} Radius in pixels
 */
export function magRadius(mag) {
  if (mag == null || Number.isNaN(Number(mag)) || mag < 0) return 4
  return Math.max(4, Math.pow(mag, 2.2) * 1.8)
}

/**
 * Get the icon character for the marker label (magnitude range indicator).
 * @param {number} mag
 * @returns {string}
 */
export function magLabel(mag) {
  if (!mag) return '?'
  return mag >= 7 ? '⚠' : mag >= 5 ? '●' : '○'
}

/**
 * Format time ago string.
 * @param {number} timestamp - Unix ms
 * @returns {string}
 */
export function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < -60) return 'scheduled'
  if (seconds < 0) return 'now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * Format magnitude for display.
 * @param {number} mag
 * @returns {string}
 */
export function formatMag(mag) {
  if (mag == null || Number.isNaN(Number(mag)) || mag < 0) return '—'
  return mag.toFixed(1)
}
