/**
 * Pure display/geometry helpers.
 *
 * These were previously private functions inside the App.vue component, which
 * meant they could only be exercised by running the whole app. Extracting them
 * makes the colour scales, intensity mapping and distance maths directly
 * testable (see tests/geo.test.mjs).
 *
 * Everything here is side-effect free and has no DOM or Vue dependency.
 */

/**
 * Marker fill colour by magnitude.
 * @param {number|null} mag
 * @returns {string} CSS colour
 */
export function magColor(mag) {
  if (mag == null || mag < 0 || Number.isNaN(Number(mag))) return '#666'
  if (mag >= 8) return '#cc00cc'
  if (mag >= 7) return '#ff2222'
  if (mag >= 6) return '#ff6600'
  if (mag >= 5) return '#ff8800'
  if (mag >= 4) return '#ffcc00'
  if (mag >= 3) return '#aacc00'
  if (mag >= 2) return '#44bb44'
  return '#66ccff'
}

/**
 * Colour by Modified Mercalli Intensity.
 * @param {number|null} mmi
 * @returns {string} CSS colour
 */
export function mmiColor(mmi) {
  if (mmi == null) return '#666'
  if (mmi >= 9) return '#cc00cc'
  if (mmi >= 8) return '#ff0000'
  if (mmi >= 7) return '#ff6600'
  if (mmi >= 6) return '#ffaa00'
  if (mmi >= 5) return '#ffdd00'
  if (mmi >= 4) return '#ccff00'
  if (mmi >= 3) return '#88cc00'
  if (mmi >= 2) return '#44aa44'
  return '#2288cc'
}

/**
 * Colour for the plain 1-10 intensity scale used by the broadcast panel.
 * @param {number|null} intensity
 * @returns {string} CSS colour
 */
export function intensityColor(intensity) {
  if (intensity == null) return '#667085'
  if (intensity >= 7) return '#b000b8'
  if (intensity >= 6) return '#e51b23'
  if (intensity >= 5) return '#ff7a00'
  if (intensity >= 4) return '#ffd23f'
  if (intensity >= 3) return '#51c878'
  if (intensity >= 2) return '#35a9d8'
  return '#8a95a6'
}

/**
 * Best-available intensity for an event: reported MMI when the catalogue has
 * it, otherwise a crude magnitude-derived estimate.
 * @param {Object} eq
 * @returns {number|null} 1-10, or null when magnitude is unusable
 */
export function estimatedIntensity(eq) {
  if (eq?.mmi != null && Number.isFinite(Number(eq.mmi))) return Math.max(1, Math.min(10, Math.round(eq.mmi)))
  const mag = Number(eq?.mag)
  if (!Number.isFinite(mag)) return null
  if (mag >= 7.5) return 7
  if (mag >= 7) return 6
  if (mag >= 6.5) return 5
  if (mag >= 6) return 4
  if (mag >= 5.5) return 3
  if (mag >= 5) return 2
  return 1
}

/**
 * Roman numeral for an MMI value.
 * @param {number} mmi
 * @returns {string}
 */
export function romanMmi(mmi) {
  const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
  return romans[Math.round(mmi)] || mmi
}

/**
 * Escape text before interpolating it into an HTML string.
 * Data-source text flows into Leaflet popups/tooltips, so this is a security
 * boundary, not just formatting.
 * @param {*} value
 * @returns {string}
 */
export function safeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Great-circle distance in km (haversine, mean Earth radius).
 * @returns {number} km, or NaN when any input is not a finite number
 */
export function greatCircleKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return NaN
  const R = 6371
  const toRad = deg => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Shortest angular distance between two longitudes, signed, in [-180, 180].
 *
 * A plain `a - b` reports 359.8 for 179.9 vs -179.9, so anything near the
 * antimeridian (Fiji, Kermadec, Tonga) failed every proximity test.
 * Note that exactly antipodal meridians come back as -180 (not +180); both are
 * the same great circle, and only |d| matters to callers.
 * @returns {number} degrees
 */
export function lngDelta(a, b) {
  let d = a - b
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return d
}

// --- Earthquake de-duplication ---

// Match tolerances; the spatial cell size mirrors the match radius.
export const DEDUPE_CELL_DEG = 0.45
export const DEDUPE_TIME_MS = 3 * 60 * 1000
export const DEDUPE_MAG = 0.5

/**
 * Do two records describe the same physical earthquake?
 * @returns {boolean}
 */
export function isSameEarthquake(a, b) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return false
  const closeInTime = Math.abs(a.time - b.time) < DEDUPE_TIME_MS
  const closeInSpace = Math.abs(a.lat - b.lat) < DEDUPE_CELL_DEG
    && Math.abs(lngDelta(a.lng, b.lng)) < DEDUPE_CELL_DEG
  const closeInMag = a.mag == null || b.mag == null || Math.abs(a.mag - b.mag) < DEDUPE_MAG
  return closeInTime && closeInSpace && closeInMag
}

/**
 * Combine two source labels into "A + B".
 * @returns {string}
 */
export function mergeSourceLabel(a, b) {
  return [...new Set(String(a).split(' + ').concat(String(b).split(' + ')).filter(Boolean))].join(' + ')
}

/**
 * Merge the same earthquake reported by several catalogues.
 *
 * Uses a spatial grid keyed by the match radius: the naive all-pairs scan is
 * O(n²) (~4M comparisons / ~25 ms for a 7-day load) and runs on every poll.
 * Output is identical to the naive version — covered by tests.
 *
 * @param {Array<Object>} items
 * @returns {Array<Object>} de-duplicated, newest-first
 */
export function dedupeEvents(items) {
  const sorted = [...items].filter(Boolean).sort((a, b) => b.time - a.time)
  const deduped = []
  const grid = new Map()
  const lngCells = Math.round(360 / DEDUPE_CELL_DEG)

  const lngCellOf = (lng) => {
    let idx = Math.floor(lng / DEDUPE_CELL_DEG) % lngCells
    if (idx < 0) idx += lngCells
    return idx
  }
  const latCellOf = (lat) => Math.floor(lat / DEDUPE_CELL_DEG)

  for (const event of sorted) {
    let match = null

    if (event.lat != null && event.lng != null) {
      const latIdx = latCellOf(event.lat)
      const lngIdx = lngCellOf(event.lng)
      // A point less than one cell away is always within the 3x3 neighbourhood.
      const candidates = []
      for (let dLat = -1; dLat <= 1; dLat++) {
        for (let dLng = -1; dLng <= 1; dLng++) {
          let nj = (lngIdx + dLng) % lngCells
          if (nj < 0) nj += lngCells
          const bucket = grid.get(`${latIdx + dLat}:${nj}`)
          if (bucket) candidates.push(...bucket)
        }
      }
      let best = -Infinity
      for (const existing of candidates) {
        if (existing.time > best && isSameEarthquake(existing, event)) {
          best = existing.time
          match = existing
        }
      }
    }

    if (match) {
      match.source = mergeSourceLabel(match.source, event.source)
      if ((event.updated || 0) > (match.updated || 0)) match.updated = event.updated
      continue
    }

    deduped.push(event)
    if (event.lat != null && event.lng != null) {
      const key = `${latCellOf(event.lat)}:${lngCellOf(event.lng)}`
      const bucket = grid.get(key)
      if (bucket) bucket.push(event)
      else grid.set(key, [event])
    }
  }
  return deduped
}

/**
 * Reference implementation of {@link dedupeEvents} using an all-pairs scan.
 * Kept so tests can assert the fast path stays behaviourally identical.
 * @param {Array<Object>} items
 * @returns {Array<Object>}
 */
export function dedupeEventsNaive(items) {
  const sorted = [...items].filter(Boolean).sort((a, b) => b.time - a.time)
  const out = []
  for (const event of sorted) {
    const match = out.find(existing => isSameEarthquake(existing, event))
    if (match) {
      match.source = mergeSourceLabel(match.source, event.source)
      if ((event.updated || 0) > (match.updated || 0)) match.updated = event.updated
      continue
    }
    out.push(event)
  }
  return out
}

/**
 * P/S wave arrival estimate for a user location.
 *
 * Uniform wave speeds that ignore crustal structure — an estimate, not an
 * early-warning service.
 *
 * @param {Object} eq
 * @param {{lat:number,lng:number}|null} userLocation
 * @param {number} [now]
 * @param {number} [pSpeed] km/s
 * @param {number} [sSpeed] km/s
 * @returns {Object|null}
 */
export function computeWaveStatus(eq, userLocation, now = Date.now(), pSpeed = 6.0, sSpeed = 3.5) {
  if (!eq || !userLocation) return null
  if (!Number.isFinite(eq.time) || eq.time > now + 60_000) return null
  const distanceKm = greatCircleKm(userLocation.lat, userLocation.lng, eq.lat, eq.lng)
  if (!Number.isFinite(distanceKm)) return null

  const elapsedSec = Math.max(0, (now - eq.time) / 1000)
  const pSec = distanceKm / pSpeed
  const sSec = distanceKm / sSpeed
  const pReached = elapsedSec >= pSec
  const sReached = elapsedSec >= sSec

  let note
  if (elapsedSec < pSec) note = `P wave arriving in ${Math.ceil(pSec - elapsedSec)}s`
  else if (elapsedSec < sSec) note = `P wave passed; S wave in ${Math.ceil(sSec - elapsedSec)}s`
  else note = `Both waves passed ~${Math.floor((elapsedSec - sSec) / 60)}m ago`

  return {
    status: sReached ? 'passed' : pReached ? 's-wave' : 'p-wave',
    note,
    pSec,
    sSec,
    distanceKm,
    pReached,
    sReached,
    elapsedSec,
  }
}
