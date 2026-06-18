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
const EMSC_BASE = 'https://www.seismicportal.eu/fdsnws/event/1/query'

// --- GFZ/GEOFON (German Research Centre for Geosciences) ---
// Free FDSN event API with GeoJSON output.
const GFZ_BASE = 'https://geofon.gfz-potsdam.de/fdsnws/event/1/query'

// --- GeoNet New Zealand ---
// Free GeoJSON earthquake endpoint. We filter the time window client-side.
const GEONET_QUAKE = 'https://api.geonet.org.nz/quake'

/**
 * Build EMSC query URL.
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

export function fdsnGeoJsonUrl(base, opts = {}) {
  const params = new URLSearchParams({
    format: 'geojson',
    limit: String(opts.limit || 200),
    minmag: String(opts.minmag || 2.5),
    orderby: 'time',
  })
  if (opts.start) params.set('starttime', opts.start)
  if (opts.end) params.set('endtime', opts.end)
  return `${base}?${params}`
}

// --- P2PQuake (Japanese community, free) ---
// WebSocket for JMA earthquake/tsunami info
// Docs: https://www.p2pquake.net/develop/json_api_v2/
export const P2PQUAKE_WS = 'wss://api.p2pquake.net/v2/ws'
export const P2PQUAKE_HISTORY = 'https://api.p2pquake.net/v2/history'

// --- Data fetcher ---

/**
 * Fetch USGS GeoJSON feed.
 * @param {string} feed - One of USGS_FEEDS keys or a raw URL
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function fetchUSGS(feed = 'all_day') {
  const url = USGS_FEEDS[feed] || feed
  const res = await fetch(url)
  if (!res.ok) throw new Error(`USGS ${res.status}`)
  return res.json()
}

/**
 * Fetch EMSC events.
 * @param {Object} [opts]
 * @returns {Promise<Array>} Array of event objects
 */
export async function fetchEMSC(opts = {}) {
  const url = emscUrl(opts)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`EMSC ${res.status}`)
  const data = await res.json()
  return data.features || data
}

export async function fetchGFZ(opts = {}) {
  const url = fdsnGeoJsonUrl(GFZ_BASE, opts)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GFZ ${res.status}`)
  const data = await res.json()
  return data.features || data
}

export async function fetchGeoNet(opts = {}) {
  const params = new URLSearchParams({ MMI: '0' })
  const res = await fetch(`${GEONET_QUAKE}?${params}`)
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
  const res = await fetch(url)
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
