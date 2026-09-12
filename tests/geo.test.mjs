/**
 * Unit tests for the pure helpers in src/utils/geo.js.
 *
 * Run with: npm test
 *
 * No test framework: this is a static site with a tiny dependency tree, and
 * the helpers are pure functions, so a small assert-based runner is enough and
 * keeps `npm install` lean. If the suite grows past a few hundred lines,
 * switch to vitest.
 */
import assert from 'node:assert/strict'
import {
  computeWaveStatus,
  dedupeEvents,
  dedupeEventsNaive,
  estimatedIntensity,
  greatCircleKm,
  isSameEarthquake,
  lngDelta,
  magColor,
  mergeSourceLabel,
  mmiColor,
  romanMmi,
  safeText,
} from '../src/utils/geo.js'

let passed = 0
let failed = 0
const failures = []

function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    failures.push({ name, err })
    console.log(`  ✗ ${name}`)
    console.log(`      ${err.message}`)
  }
}
function group(name) {
  console.log(`\n${name}`)
}

// --- magnitude colour scale ---
group('magColor')
test('returns grey for null/negative/NaN', () => {
  assert.equal(magColor(null), '#666')
  assert.equal(magColor(-1), '#666')
  assert.equal(magColor(NaN), '#666')
})
test('maps each band to its documented colour', () => {
  assert.equal(magColor(8.1), '#cc00cc')
  assert.equal(magColor(7), '#ff2222')
  assert.equal(magColor(6), '#ff6600')
  assert.equal(magColor(5), '#ff8800')
  assert.equal(magColor(4), '#ffcc00')
  assert.equal(magColor(3), '#aacc00')
  assert.equal(magColor(2), '#44bb44')
  assert.equal(magColor(1.2), '#66ccff')
})
test('bands are inclusive at the lower bound', () => {
  // A magnitude exactly on a threshold must take the stronger colour.
  assert.equal(magColor(5.0), magColor(5.9))
  assert.notEqual(magColor(5.0), magColor(4.99))
})

// --- MMI ---
group('mmiColor / romanMmi')
test('roman numerals round to the nearest integer', () => {
  assert.equal(romanMmi(1), 'I')
  assert.equal(romanMmi(7), 'VII')
  assert.equal(romanMmi(7.4), 'VII')
  assert.equal(romanMmi(12), 'XII')
})
test('out-of-range MMI falls through to the raw value', () => {
  assert.equal(romanMmi(0), 0)       // romans[0] is '' -> falsy -> returns input
  assert.equal(romanMmi(99), 99)
})
test('mmiColor handles null', () => {
  assert.equal(mmiColor(null), '#666')
})

// --- intensity estimate ---
group('estimatedIntensity')
test('prefers a reported MMI over the magnitude estimate', () => {
  assert.equal(estimatedIntensity({ mmi: 6, mag: 4.0 }), 6)
})
test('clamps reported MMI into 1..10', () => {
  assert.equal(estimatedIntensity({ mmi: 14 }), 10)
  assert.equal(estimatedIntensity({ mmi: 0 }), 1)
})
test('falls back to a magnitude-derived estimate', () => {
  assert.equal(estimatedIntensity({ mag: 7.6 }), 7)
  assert.equal(estimatedIntensity({ mag: 7.0 }), 6)
  assert.equal(estimatedIntensity({ mag: 6.0 }), 4)
  assert.equal(estimatedIntensity({ mag: 5.0 }), 2)
  assert.equal(estimatedIntensity({ mag: 3.0 }), 1)
})
test('returns null when magnitude is unusable', () => {
  assert.equal(estimatedIntensity({}), null)
  assert.equal(estimatedIntensity({ mag: NaN }), null)
})

// --- escaping (security boundary: catalogue text goes into popup HTML) ---
group('safeText')
test('escapes every HTML-significant character', () => {
  assert.equal(safeText('<script>alert("x")</script>'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
  assert.equal(safeText("it's & that"), 'it&#039;s &amp; that')
})
test('handles null/undefined without throwing', () => {
  assert.equal(safeText(null), '')
  assert.equal(safeText(undefined), '')
})

// --- distance ---
group('greatCircleKm')
test('matches known city distances within 1%', () => {
  const cases = [
    ['Sydney-Tokyo', -33.87, 151.21, 35.68, 139.69, 7826],
    ['London-NYC', 51.51, -0.13, 40.71, -74.01, 5570],
    ['Sydney-Peru', -33.87, 151.21, -3.823, -77.513, 13413],
  ]
  for (const [name, a, b, c, d, expected] of cases) {
    const got = greatCircleKm(a, b, c, d)
    const err = Math.abs(got - expected) / expected
    assert.ok(err < 0.01, `${name}: got ${got.toFixed(0)}km, expected ~${expected}km (${(err * 100).toFixed(2)}% off)`)
  }
})
test('identical points are zero', () => {
  assert.equal(greatCircleKm(0.97, 50.03, 0.97, 50.03), 0)
})
test('non-finite input yields NaN', () => {
  assert.ok(Number.isNaN(greatCircleKm(NaN, 0, 0, 0)))
  assert.ok(Number.isNaN(greatCircleKm(0, 0, null, 0)))
  assert.ok(Number.isNaN(greatCircleKm(0, 0, 0, 'x')))
})

// --- antimeridian regression ---
group('lngDelta (antimeridian regression)')
test('uses the short way around the globe', () => {
  assert.ok(Math.abs(lngDelta(179.9, -179.9) - (-0.2)) < 1e-9)
  assert.ok(Math.abs(lngDelta(-179.9, 179.9) - 0.2) < 1e-9)
})
test('is zero at the same meridian', () => {
  assert.equal(lngDelta(120, 120), 0)
  assert.equal(lngDelta(0, 0), 0)
})
test('stays within [-180, 180]', () => {
  for (const [a, b] of [[179, -179], [-179, 179], [0, 180], [180, 0], [90, -90]]) {
    const d = lngDelta(a, b)
    assert.ok(d >= -180 && d <= 180, `lngDelta(${a},${b}) = ${d}`)
  }
})

// --- dedupe equivalence + correctness ---
group('dedupeEvents')
test('collapses the same quake from two catalogues', () => {
  const a = { id: 'a', lat: 10, lng: 10, mag: 5.2, time: 1e12, source: 'USGS' }
  const b = { id: 'b', lat: 10.1, lng: 10.1, mag: 5.3, time: 1e12 + 30_000, source: 'EMSC' }
  const out = dedupeEvents([a, b])
  assert.equal(out.length, 1)
  assert.equal(out[0].source, 'EMSC + USGS')
})
test('merges across the antimeridian (regression)', () => {
  const a = { id: 'a', lat: -17.5, lng: 179.9, mag: 5.4, time: 1e12, source: 'USGS' }
  const b = { id: 'b', lat: -17.5, lng: -179.9, mag: 5.5, time: 1e12 + 30_000, source: 'EMSC' }
  assert.equal(dedupeEvents([a, b]).length, 1, 'date-line quake should merge')
})
test('keeps genuinely distinct quakes apart', () => {
  const a = { id: 'a', lat: 10, lng: 10, mag: 5.2, time: 1e12, source: 'USGS' }
  const b = { id: 'b', lat: 12, lng: 12, mag: 5.2, time: 1e12, source: 'USGS' }   // far away
  const c = { id: 'c', lat: 10, lng: 10, mag: 5.2, time: 1e12 + 600_000, source: 'USGS' } // much later
  const d = { id: 'd', lat: 10, lng: 10, mag: 7.5, time: 1e12, source: 'USGS' }   // very different mag
  assert.equal(dedupeEvents([a, b, c, d]).length, 4)
})
test('matches the naive implementation exactly (equivalence)', () => {
  // Deterministic pseudo-random field of events, including a date-line cluster.
  let seed = 42
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  const items = []
  for (let i = 0; i < 600; i++) {
    const nearDateLine = i % 7 === 0
    items.push({
      id: `e${i}`,
      lat: -90 + rand() * 180,
      lng: nearDateLine ? (rand() < 0.5 ? 179.9 : -179.9) : -180 + rand() * 360,
      mag: +(rand() * 8).toFixed(2),
      time: 1e12 + Math.floor(rand() * 10) * 60_000,
      source: ['USGS', 'EMSC', 'GFZ', 'GeoNet'][i % 4],
    })
  }
  const fast = dedupeEvents(structuredClone(items))
  const slow = dedupeEventsNaive(structuredClone(items))
  assert.equal(fast.length, slow.length, `count differs: fast=${fast.length} naive=${slow.length}`)
  assert.deepEqual(fast.map(e => e.id), slow.map(e => e.id), 'surviving ids differ')
  assert.deepEqual(fast.map(e => e.source), slow.map(e => e.source), 'merged source labels differ')
})
test('handles empty and null-heavy input', () => {
  assert.equal(dedupeEvents([]).length, 0)
  assert.equal(dedupeEvents([null, undefined]).length, 0)
})
test('events without coordinates are kept, never merged', () => {
  const a = { id: 'a', lat: null, lng: null, mag: 5, time: 1e12, source: 'X' }
  const b = { id: 'b', lat: null, lng: null, mag: 5, time: 1e12, source: 'Y' }
  assert.equal(dedupeEvents([a, b]).length, 2)
})

group('isSameEarthquake / mergeSourceLabel')
test('isSameEarthquake rejects missing coordinates', () => {
  assert.equal(isSameEarthquake({ lat: null, lng: 1, time: 1 }, { lat: 1, lng: 1, time: 1 }), false)
})
test('mergeSourceLabel de-duplicates repeated sources', () => {
  assert.equal(mergeSourceLabel('USGS + EMSC', 'EMSC'), 'USGS + EMSC')
  assert.equal(mergeSourceLabel('USGS', 'EMSC'), 'USGS + EMSC')
})

// --- wave arrival ---
group('computeWaveStatus')
const SYDNEY = { lat: -33.87, lng: 151.21 }
test('returns null without a user location', () => {
  assert.equal(computeWaveStatus({ lat: 0, lng: 0, time: 1 }, null), null)
})
test('returns null for a future event', () => {
  const now = 1_700_000_000_000
  assert.equal(computeWaveStatus({ lat: 1, lng: 1, time: now + 3_600_000 }, SYDNEY, now), null)
})
test('nearby quake shows both waves as passed', () => {
  const now = 1_700_000_000_000
  const eq = { lat: -33.95, lng: 151.35, time: now - 4 * 60_000 }
  const s = computeWaveStatus(eq, SYDNEY, now)
  assert.equal(s.status, 'passed')
  assert.ok(s.pReached && s.sReached)
  assert.ok(s.distanceKm > 15 && s.distanceKm < 25, `distance ${s.distanceKm}`)
})
test('distant quake is still waiting on the P wave', () => {
  const now = 1_700_000_000_000
  const eq = { lat: 35.68, lng: 139.69, time: now - 2 * 60_000 }   // Tokyo
  const s = computeWaveStatus(eq, SYDNEY, now)
  assert.equal(s.status, 'p-wave')
  assert.equal(s.pReached, false)
  assert.ok(/arriving in/.test(s.note), s.note)
  assert.ok(s.pSec < s.sSec, 'P must arrive before S')
})

// --- summary ---
console.log(`\n${'─'.repeat(50)}`)
console.log(`${passed} passed, ${failed} failed`)
if (failed) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  ✗ ${f.name}\n      ${f.err.message}`)
  process.exit(1)
}
console.log('All tests passed.')
