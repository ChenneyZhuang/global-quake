<template>
  <div class="app">
    <header class="stats-bar">
      <button
        class="hamburger icon-btn"
        type="button"
        :aria-label="mobileSidebarOpen ? 'Close event list' : 'Open event list'"
        :aria-expanded="mobileSidebarOpen"
        @click="mobileSidebarOpen = !mobileSidebarOpen"
      >
        <span aria-hidden="true">{{ mobileSidebarOpen ? 'x' : '☰' }}</span>
        <span v-if="countM5 > 0" class="hamburger-badge">{{ countM5 }}</span>
      </button>
      <div class="stats-title">
        <span class="brand-mark" aria-hidden="true"></span>
        <span>Global Quake</span>
      </div>
      <div class="stats-info">
        <span class="stat-badge stat-count"><span class="stat-label">Events</span>{{ events.length }}</span>
        <span v-if="countM5 > 0" class="stat-badge stat-m5"><span class="stat-label">M5+</span>{{ countM5 }}</span>
        <span v-if="countM7 > 0" class="stat-badge stat-m7"><span class="stat-label">M7+</span>{{ countM7 }}</span>
        <span class="stat-badge stat-live" :class="{ live: connected }">
          <span class="live-dot" aria-hidden="true"></span>{{ loadingData ? 'Loading' : (connected ? 'Live' : 'Paused') }}
        </span>
        <span class="stat-badge stat-window"><span class="stat-label">Window</span>{{ selectedFeedLabel }}</span>
        <span class="stat-badge stat-source"><span class="stat-label">Sources</span>{{ activeSourceText }}</span>
        <span class="stat-badge stat-time"><span class="stat-label">Updated</span>{{ lastUpdate }}</span>
      </div>
    </header>

    <button class="reset-btn icon-btn" type="button" @click="resetView" title="Reset view" aria-label="Reset map view">
      <span aria-hidden="true">⌂</span>
    </button>

    <div v-if="newAlerts.length" class="alert-bar" :class="{ shifted: !sidebarCollapsed && !isMobile }">
      <span v-for="alert in newAlerts.slice(0, 3)" :key="alert.id" class="alert-item">
        <b :style="{ color: magColor(alert.mag) }">M{{ formatMag(alert.mag) }}</b>
        {{ alert.place || 'Unknown location' }} · {{ timeAgo(alert.time) }}
      </span>
    </div>

    <aside
      class="sidebar"
      :aria-hidden="isMobile && !mobileSidebarOpen"
      :class="{
        collapsed: sidebarCollapsed && !isMobile,
        'mobile-open': isMobile && mobileSidebarOpen,
        'mobile-hidden': isMobile && !mobileSidebarOpen,
      }"
    >
      <div class="sidebar-header">
        <div>
          <h3>{{ filteredEvents.length }} earthquakes</h3>
          <p v-if="!sidebarCollapsed || isMobile">{{ selectedFeedLabel }} · {{ sourceStatusLabel }}</p>
        </div>
        <button
          class="toggle-btn icon-btn"
          type="button"
          :aria-label="isMobile ? 'Close event list' : (sidebarCollapsed ? 'Expand event list' : 'Collapse event list')"
          @click="isMobile ? mobileSidebarOpen = false : sidebarCollapsed = !sidebarCollapsed"
        >
          <span aria-hidden="true">{{ isMobile ? 'x' : (sidebarCollapsed ? '›' : '‹') }}</span>
        </button>
      </div>

      <div v-if="!sidebarCollapsed || isMobile" class="sidebar-filters">
        <div class="filter-field">
          <label class="select-label" for="feed-filter">Catalog window</label>
          <select id="feed-filter" v-model="currentFeed" class="filter-select" @change="switchFeed(currentFeed)">
            <option v-for="f in catalogWindows" :key="f.key" :value="f.key">{{ f.label }}</option>
          </select>
        </div>
        <div class="filter-field">
          <label class="select-label" for="mag-filter">Magnitude</label>
          <select id="mag-filter" v-model.number="magFilter" class="filter-select" @change="renderMarkers">
            <option value="0">All magnitudes</option>
            <option value="2.5">M2.5+</option>
            <option value="4">M4.0+</option>
            <option value="5">M5.0+</option>
            <option value="6">M6.0+</option>
          </select>
        </div>
        <div class="filter-field source-field">
          <div class="select-label">Sources</div>
          <div class="source-toggles">
            <button
              v-for="source in sourceOptions"
              :key="source.key"
              type="button"
              class="source-toggle"
              :class="{ active: selectedSources.includes(source.key) }"
              :aria-pressed="selectedSources.includes(source.key)"
              @click="toggleSource(source.key)"
            >
              {{ source.label }}
            </button>
          </div>
        </div>
        <div class="filter-field layer-field">
          <div class="select-label">Map layers</div>
          <button
            type="button"
            class="layer-toggle"
            :class="{ active: showDepthRings }"
            :aria-pressed="showDepthRings"
            @click="toggleDepthRings"
          >
            <span class="toggle-dot" aria-hidden="true"></span>
            Depth rings
          </button>
        </div>
        <div class="filter-field quick-field">
          <div class="select-label">Quick focus</div>
          <div class="quick-actions">
            <button type="button" class="quick-action" :disabled="!latestEvent" @click="latestEvent && focusEvent(latestEvent)">
              Latest
            </button>
            <button type="button" class="quick-action" :disabled="!strongestEvent" @click="strongestEvent && focusEvent(strongestEvent)">
              Strongest
            </button>
          </div>
        </div>
      </div>

      <div v-if="!sidebarCollapsed || isMobile" class="sidebar-list">
        <div v-if="hiddenEventCount > 0" class="list-limit-note">
          Showing latest {{ displayedEvents.length }} of {{ filteredEvents.length }}. Raise the magnitude filter to narrow the catalog.
        </div>
        <button
          v-for="eq in displayedEvents"
          :key="eq.id"
          type="button"
          class="event-card"
          :class="{ significant: eq.mag >= 5, major: eq.mag >= 7 }"
          @click="focusEvent(eq)"
        >
          <span class="mag-badge" :style="{ background: magColor(eq.mag) }">{{ formatMag(eq.mag) }}</span>
          <span class="event-info">
            <span class="event-place">{{ eq.place || 'Unknown location' }}</span>
            <span class="event-meta">
              <span>{{ eq.source }}</span>
              <span>{{ eq.depth?.toFixed(0) || '?' }}km</span>
              <span v-if="eq.mmi != null" class="event-mmi" :style="{ color: mmiColor(eq.mmi) }">MMI {{ romanMmi(eq.mmi) }}</span>
              <span>{{ timeAgo(eq.time) }}</span>
            </span>
          </span>
        </button>
        <div v-if="filteredEvents.length === 0" class="empty-state">
          {{ events.length ? 'No events match filter' : 'Loading earthquake data...' }}
        </div>
      </div>
    </aside>

    <div v-if="isMobile && mobileSidebarOpen" class="sidebar-backdrop" @click="mobileSidebarOpen = false"></div>

    <main ref="mapContainer" class="map-container"></main>

    <section v-if="selectedEvent" class="detail-panel" :class="{ shifted: !sidebarCollapsed && !isMobile }">
      <button class="detail-close icon-btn" type="button" aria-label="Close event details" @click="selectedEvent = null">x</button>
      <div class="detail-mag" :style="{ color: magColor(selectedEvent.mag) }">M{{ formatMag(selectedEvent.mag) }}</div>
      <div class="detail-place">{{ selectedEvent.place || 'Unknown location' }}</div>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Time</span>
          <span class="detail-value">{{ new Date(selectedEvent.time).toLocaleString() }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Depth</span>
          <span class="detail-value">{{ selectedEvent.depth?.toFixed(1) || '?' }} km</span>
        </div>
        <div v-if="selectedEvent.mmi != null" class="detail-item">
          <span class="detail-label">Max Intensity</span>
          <span class="detail-value" :style="{ color: mmiColor(selectedEvent.mmi) }">MMI {{ romanMmi(selectedEvent.mmi) }}</span>
        </div>
        <div v-if="selectedEvent.felt" class="detail-item">
          <span class="detail-label">Felt Reports</span>
          <span class="detail-value">{{ selectedEvent.felt }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Source</span>
          <span class="detail-value">{{ selectedEvent.source }}</span>
        </div>
        <div v-if="selectedEvent.tsunami" class="detail-item">
          <span class="detail-label">Tsunami</span>
          <span class="detail-value danger">Alert</span>
        </div>
      </div>
    </section>

    <section class="legend-panel" :class="{ open: legendOpen, mobile: isMobile }">
      <button
        v-if="isMobile"
        class="legend-toggle icon-btn"
        type="button"
        :aria-label="legendOpen ? 'Close legend' : 'Open legend'"
        :aria-expanded="legendOpen"
        @click="legendOpen = !legendOpen"
      >
        <span aria-hidden="true">{{ legendOpen ? 'x' : '▥' }}</span>
      </button>
      <template v-if="!isMobile || legendOpen">
        <div class="legend-section">
          <div class="legend-title">Magnitude</div>
          <div v-for="item in magLegend" :key="item.label" class="legend-row">
            <span class="legend-dot" :style="{ background: item.color }"></span>
            <span class="legend-label">{{ item.label }}</span>
          </div>
        </div>
        <div v-if="showDepthRings" class="legend-section">
          <div class="legend-title">Depth</div>
          <div v-for="item in depthLegend" :key="item.label" class="legend-row">
            <span class="legend-dot depth-ring" :style="{ borderColor: item.color }"></span>
            <span class="legend-label">{{ item.label }}</span>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import L from 'leaflet'
import {
  fetchEMSC,
  fetchGFZ,
  fetchGeoNet,
  fetchUSGS,
  depthColor,
  formatMag,
  normalizeEvent,
  P2PQUAKE_WS,
  timeAgo,
} from './utils/api.js'

const catalogWindows = [
  { key: 'all_hour', label: 'Past hour', hours: 1 },
  { key: 'all_day', label: 'Past 24 hours', hours: 24 },
  { key: 'all_week', label: 'Past 7 days', hours: 24 * 7 },
]

const sourceOptions = [
  { key: 'usgs', label: 'USGS' },
  { key: 'emsc', label: 'EMSC Europe' },
  { key: 'gfz', label: 'GFZ/GEOFON' },
  { key: 'geonet', label: 'GeoNet NZ' },
  { key: 'jma', label: 'JMA live' },
]

const magLegend = [
  { label: 'M1-2', color: '#44bb44' },
  { label: 'M3-4', color: '#ffcc00' },
  { label: 'M5-6', color: '#ff8800' },
  { label: 'M7+', color: '#ff2222' },
]

const depthLegend = [
  { label: '0-10 km', color: '#8ef6ff' },
  { label: '10-30 km', color: '#37d4d8' },
  { label: '30-70 km', color: '#2ea8ff' },
  { label: '70-150 km', color: '#3476d8' },
  { label: '150-300 km', color: '#5156b8' },
  { label: '300+ km', color: '#6b4aa5' },
]

const mapContainer = ref(null)
const events = ref([])
const newAlerts = ref([])
const newIds = ref(new Set())
const currentFeed = ref('all_day')
const selectedSources = ref(['usgs', 'emsc', 'gfz', 'geonet', 'jma'])
const magFilter = ref(0)
const selectedEvent = ref(null)
const lastUpdate = ref('-')
const connected = ref(false)
const loadingData = ref(false)
const showDepthRings = ref(false)
const sidebarCollapsed = ref(true)
const mobileSidebarOpen = ref(false)
const legendOpen = ref(false)
const isMobile = ref(false)
const p2pConnected = ref(false)

let map = null
let markerLayer = null
let mapRenderer = null
let resizeObserver = null
let pollTimer = null
let p2pSocket = null
let lastFetchTime = 0
let initialLoadDone = false
let suppressNextFreshAlerts = false
let knownIds = new Set()
let alertTimers = []
const feedCache = new Map()

const FEED_CACHE_MS = 55_000
const CATALOG_POLL_MS = 60_000
const ALERT_EVENT_MAX_AGE_MS = 15 * 60 * 1000
const ALERT_DISPLAY_MS = 15_000
const NEW_MARKER_MS = 30_000

const selectedFeed = computed(() => catalogWindows.find(feed => feed.key === currentFeed.value) || catalogWindows[1])
const selectedFeedLabel = computed(() => selectedFeed.value.label)
const sortedEvents = computed(() => [...events.value].sort((a, b) => b.time - a.time))
const filteredEvents = computed(() => {
  if (magFilter.value <= 0) return sortedEvents.value
  return sortedEvents.value.filter(event => event.mag >= magFilter.value)
})
const displayedEvents = computed(() => filteredEvents.value.slice(0, 650))
const hiddenEventCount = computed(() => Math.max(0, filteredEvents.value.length - displayedEvents.value.length))
const countM5 = computed(() => events.value.filter(event => event.mag >= 5).length)
const countM7 = computed(() => events.value.filter(event => event.mag >= 7).length)
const latestEvent = computed(() => sortedEvents.value[0] || null)
const strongestEvent = computed(() => sortedEvents.value.reduce((best, event) => {
  if (!best) return event
  return (event.mag ?? -1) > (best.mag ?? -1) ? event : best
}, null))
const activeSourceText = computed(() => {
  const labels = []
  if (selectedSources.value.includes('usgs')) labels.push('USGS')
  if (selectedSources.value.includes('emsc')) labels.push('EMSC')
  if (selectedSources.value.includes('gfz')) labels.push('GFZ')
  if (selectedSources.value.includes('geonet')) labels.push('GeoNet')
  if (selectedSources.value.includes('jma') && p2pConnected.value) labels.push('JMA')
  return labels.length ? labels.join(' + ') : 'No sources'
})
const sourceStatusLabel = computed(() => activeSourceText.value)

function magColor(mag) {
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

function mmiColor(mmi) {
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

function romanMmi(mmi) {
  const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
  return romans[Math.round(mmi)] || mmi
}

function safeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function popupContentFor(eq) {
  const safePlace = safeText(eq.place || 'Unknown location')
  const safeSource = safeText(eq.source || 'Unknown')
  const safeUrl = eq.url && /^https?:\/\//.test(eq.url) ? eq.url : null
  return `
    <div style="font-family:-apple-system,sans-serif;font-size:13px;min-width:200px;">
      <div style="font-size:24px;font-weight:800;color:${magColor(eq.mag)};margin-bottom:4px;">M${formatMag(eq.mag)}</div>
      <div style="font-weight:650;margin-bottom:8px;">${safePlace}</div>
      <div style="color:#aaa;line-height:1.7;font-size:12px;">
        <div>Time: <b>${new Date(eq.time).toLocaleString()}</b></div>
        <div>Depth: <b>${eq.depth?.toFixed(1) || '?'} km</b></div>
        <div>Source: <b>${safeSource}</b></div>
        ${eq.mmi != null ? `<div>Max Intensity: <b style="color:${mmiColor(eq.mmi)};">MMI ${romanMmi(eq.mmi)}</b></div>` : ''}
        ${eq.tsunami ? '<div style="color:#ff4444;font-weight:700;">Tsunami Alert</div>' : ''}
      </div>
      ${safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#4da6ff;display:inline-block;margin-top:8px;font-size:12px;">Source detail</a>` : ''}
    </div>
  `
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

function initMap() {
  map = L.map(mapContainer.value, {
    center: [20, 0],
    zoom: 2,
    zoomControl: false,
    attributionControl: true,
    touchZoom: true,
    tap: true,
    bounceAtZoomLimits: false,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
  })

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map)

  L.control.zoom({ position: 'bottomright' }).addTo(map)
  markerLayer = L.layerGroup().addTo(map)
  mapRenderer = L.canvas({ padding: 0.5 })

  map.setMinZoom(1)
  map.options.worldCopyJump = true
  map.setMaxBounds([[-85, -540], [85, 540]])
  map.options.maxBoundsViscosity = 0.2
  map.on('click', () => { selectedEvent.value = null })
  map.on('moveend zoomend', renderMarkers)

  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => map?.invalidateSize())
    resizeObserver.observe(mapContainer.value)
  }
}

function renderMarkers() {
  if (!markerLayer || !map) return
  markerLayer.clearLayers()
  const zoom = map.getZoom()
  const zoomScale = markerZoomScale(zoom)
  const worldOffsets = visibleWorldOffsets()

  for (const eq of filteredEvents.value) {
    if (eq.lat == null || eq.lng == null) continue
    const radius = markerRadius(eq.mag, zoomScale)
    const ringWeight = newIds.value.has(eq.id) ? 3.5 : markerStrokeWeight(eq)
    const strokeColor = newIds.value.has(eq.id)
      ? '#ffeb66'
      : (showDepthRings.value ? depthColor(eq.depth) : markerNeutralStroke(eq.mag))

    for (const offset of worldOffsets) {
      const wrappedLng = eq.lng + offset
      if (!isLngNearView(wrappedLng)) continue

      const circle = L.circleMarker([eq.lat, wrappedLng], {
        radius,
        fillColor: magColor(eq.mag),
        color: strokeColor,
        weight: ringWeight,
        opacity: 0.95,
        fillOpacity: eq.mag >= 5 ? 0.82 : 0.72,
        className: newIds.value.has(eq.id) ? 'marker-new' : '',
        renderer: mapRenderer,
      })

      circle.bindPopup(popupContentFor(eq), { maxWidth: 300 })
      circle.bindTooltip(`<b style="color:${magColor(eq.mag)}">M${formatMag(eq.mag)}</b> ${safeText(eq.place || 'Unknown location')}`, {
        direction: 'top',
        offset: [0, -radius - 4],
        opacity: 0.9,
      })
      circle.on('click', () => {
        selectedEvent.value = eq
        if (isMobile.value) mobileSidebarOpen.value = false
      })
      circle.on('mouseover', function () {
        this.setStyle({ fillOpacity: 0.95, weight: ringWeight + 1 })
      })
      circle.on('mouseout', function () {
        this.setStyle({ fillOpacity: 0.78, weight: ringWeight })
      })
      circle.addTo(markerLayer)
    }
  }
}

function markerZoomScale(zoom) {
  if (zoom <= 1.5) return 0.86
  if (zoom <= 3) return 0.94
  if (zoom >= 6) return 1.08
  return 1
}

function markerRadius(mag, zoomScale = 1) {
  const value = Number.isFinite(mag) ? mag : 2
  return Math.max(4, Math.min(18, 3.5 + value * 1.85)) * zoomScale
}

function markerStrokeWeight(eq) {
  if (!showDepthRings.value) return eq.mag >= 5 ? 1.8 : 1.2
  if (eq.depth == null || Number.isNaN(Number(eq.depth))) return 1.4
  if (eq.depth <= 30) return 2.4
  if (eq.depth <= 150) return 1.9
  return 1.5
}

function markerNeutralStroke(mag) {
  if (mag >= 6) return 'rgba(255,255,255,0.88)'
  if (mag >= 4) return 'rgba(255,255,255,0.58)'
  return 'rgba(255,255,255,0.34)'
}

function toggleDepthRings() {
  showDepthRings.value = !showDepthRings.value
  nextTick().then(renderMarkers)
}

function visibleWorldOffsets() {
  if (!map) return [0]
  const bounds = map.getBounds()
  const minWorld = Math.floor((bounds.getWest() - 180) / 360)
  const maxWorld = Math.ceil((bounds.getEast() + 180) / 360)
  const offsets = []
  for (let world = minWorld; world <= maxWorld; world += 1) offsets.push(world * 360)
  return offsets
}

function isLngNearView(lng) {
  if (!map) return true
  const bounds = map.getBounds()
  return lng >= bounds.getWest() - 80 && lng <= bounds.getEast() + 80
}

function focusEvent(eq) {
  if (!map || eq.lat == null || eq.lng == null) return
  selectedEvent.value = eq
  if (isMobile.value) mobileSidebarOpen.value = false
  const mag = Number.isFinite(eq.mag) ? eq.mag : 3
  const openPopup = () => L.popup({ maxWidth: 300 }).setLatLng([eq.lat, eq.lng]).setContent(popupContentFor(eq)).openOn(map)
  map.once('moveend', () => nextTick().then(openPopup))
  map.flyTo([eq.lat, eq.lng], Math.max(6, 8 - mag * 0.4), { duration: 1 })
  setTimeout(openPopup, 1300)
}

function convertJmaScale(scale) {
  if (scale == null || scale < 0) return null
  return Math.max(1, Math.min(10, Math.ceil(scale / 10)))
}

function isAlertableNewEvent(eq, now = Date.now()) {
  if (!Number.isFinite(eq?.time)) return false
  return eq.time <= now + 2 * 60 * 1000 && now - eq.time <= ALERT_EVENT_MAX_AGE_MS
}

function pushNewAlerts(items) {
  const freshAlerts = items.filter(eq => isAlertableNewEvent(eq)).sort((a, b) => b.time - a.time)
  if (!freshAlerts.length) return

  newAlerts.value = [...freshAlerts, ...newAlerts.value].slice(0, 5)
  alertTimers.forEach(clearTimeout)
  alertTimers = []
  alertTimers.push(setTimeout(() => { newAlerts.value = [] }, ALERT_DISPLAY_MS))

  const ids = new Set(newIds.value)
  freshAlerts.forEach(eq => ids.add(eq.id))
  newIds.value = ids
  alertTimers.push(setTimeout(() => {
    newIds.value = new Set()
    nextTick().then(renderMarkers)
  }, NEW_MARKER_MS))
}

async function loadData() {
  const now = Date.now()
  if (now - lastFetchTime < CATALOG_POLL_MS) return

  try {
    connected.value = true
    loadingData.value = true
    lastFetchTime = now

    const catalogEvents = await fetchCatalogEvents(currentFeed.value)
    const seen = new Set()
    const merged = []
    const fresh = []

    for (const eq of catalogEvents) {
      if (!eq?.id || seen.has(eq.id)) continue
      seen.add(eq.id)
      if (!knownIds.has(eq.id)) {
        knownIds.add(eq.id)
        fresh.push(eq)
      }
      merged.push(eq)
    }

    for (const eq of events.value) {
      if (eq.source === 'JMA' && selectedSources.value.includes('jma') && !seen.has(eq.id)) merged.push(eq)
    }

    events.value = merged
    lastUpdate.value = new Date().toLocaleTimeString()

    if (fresh.length > 0 && initialLoadDone && !suppressNextFreshAlerts) pushNewAlerts(fresh)
    suppressNextFreshAlerts = false
    initialLoadDone = true

    await nextTick()
    renderMarkers()
  } catch (err) {
    console.error('Failed to fetch earthquake data:', err)
    connected.value = false
  } finally {
    loadingData.value = false
  }
}

async function fetchCatalogEvents(feed) {
  const cacheKey = `${feed}|${selectedSources.value.filter(source => source !== 'jma').sort().join(',')}`
  const cached = feedCache.get(cacheKey)
  if (cached && Date.now() - cached.time < FEED_CACHE_MS) return cached.events

  const tasks = []
  if (selectedSources.value.includes('usgs')) {
    tasks.push(fetchUSGS(feed)
      .then(data => (data.features || []).map(feature => normalizeEvent(feature, 'usgs')))
      .catch(err => {
        console.warn('USGS source failed:', err)
        return []
      }))
  }
  if (selectedSources.value.includes('emsc')) {
    const start = new Date(Date.now() - selectedFeed.value.hours * 60 * 60 * 1000).toISOString()
    tasks.push(fetchEMSC({ start, minmag: fdsnMinMag(feed), limit: sourceLimit(feed) })
      .then(features => (features || []).map(feature => normalizeEvent(feature, 'emsc')))
      .catch(err => {
        console.warn('EMSC source failed:', err)
        return []
      }))
  }
  if (selectedSources.value.includes('gfz')) {
    const start = new Date(Date.now() - selectedFeed.value.hours * 60 * 60 * 1000).toISOString()
    tasks.push(fetchGFZ({ start, minmag: fdsnMinMag(feed), limit: sourceLimit(feed) })
      .then(features => (features || []).map(feature => normalizeEvent(feature, 'gfz')))
      .catch(err => {
        console.warn('GFZ source failed:', err)
        return []
      }))
  }
  if (selectedSources.value.includes('geonet')) {
    const start = new Date(Date.now() - selectedFeed.value.hours * 60 * 60 * 1000).toISOString()
    tasks.push(fetchGeoNet({ start, limit: feed === 'all_week' ? 350 : 180 })
      .then(features => (features || []).map(feature => normalizeEvent(feature, 'geonet')))
      .catch(err => {
        console.warn('GeoNet source failed:', err)
        return []
      }))
  }

  const merged = dedupeEvents((await Promise.all(tasks)).flat())
  feedCache.set(cacheKey, { time: Date.now(), events: merged })
  return merged
}

function fdsnMinMag(feed) {
  return feed === 'all_week' ? 2.5 : 2
}

function sourceLimit(feed) {
  if (feed === 'all_week') return 500
  if (feed === 'all_day') return 250
  return 80
}

function dedupeEvents(items) {
  const sorted = [...items].filter(Boolean).sort((a, b) => b.time - a.time)
  const deduped = []
  for (const event of sorted) {
    const match = deduped.find(existing => isSameEarthquake(existing, event))
    if (match) {
      match.source = mergeSourceLabel(match.source, event.source)
      if ((event.updated || 0) > (match.updated || 0)) match.updated = event.updated
      continue
    }
    deduped.push(event)
  }
  return deduped
}

function isSameEarthquake(a, b) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return false
  const closeInTime = Math.abs(a.time - b.time) < 3 * 60 * 1000
  const closeInSpace = Math.abs(a.lat - b.lat) < 0.45 && Math.abs(a.lng - b.lng) < 0.45
  const closeInMag = a.mag == null || b.mag == null || Math.abs(a.mag - b.mag) < 0.5
  return closeInTime && closeInSpace && closeInMag
}

function mergeSourceLabel(a, b) {
  return [...new Set(String(a).split(' + ').concat(String(b).split(' + ')).filter(Boolean))].join(' + ')
}

function connectP2PQuake() {
  if (p2pSocket) return
  try {
    p2pSocket = new WebSocket(P2PQUAKE_WS)
    p2pSocket.onopen = () => { p2pConnected.value = true }
    p2pSocket.onmessage = (message) => {
      try {
        const msg = JSON.parse(message.data)
        if (msg.code !== 551 || !msg.earthquake || !selectedSources.value.includes('jma')) return
        const eq = msg.earthquake
        const hypocenter = eq.hypocenter || {}
        const id = `p2p-${msg.id || eq.id || eq.time || Date.now()}`
        if (knownIds.has(id)) return
        knownIds.add(id)
        const event = {
          id,
          lat: hypocenter.latitude,
          lng: hypocenter.longitude,
          depth: hypocenter.depth,
          mag: hypocenter.magnitude ?? eq.magnitude,
          place: hypocenter.name || 'Japan region',
          time: eq.time ? new Date(eq.time).getTime() : Date.now(),
          source: 'JMA',
          mmi: convertJmaScale(eq.maxScale),
          tsunami: eq.domesticTsunami && eq.domesticTsunami !== 'None' ? 1 : 0,
        }
        if (event.lat == null || event.lng == null) return
        events.value.unshift(event)
        pushNewAlerts([event])
        lastUpdate.value = new Date().toLocaleTimeString()
        nextTick().then(renderMarkers)
      } catch {
        // Ignore malformed real-time messages.
      }
    }
    p2pSocket.onclose = () => {
      p2pConnected.value = false
      p2pSocket = null
      setTimeout(connectP2PQuake, 10_000)
    }
    p2pSocket.onerror = () => p2pSocket?.close()
  } catch {
    // WebSocket not available in this browser.
  }
}

function switchFeed(feed) {
  currentFeed.value = feed
  lastFetchTime = 0
  suppressNextFreshAlerts = true
  newAlerts.value = []
  newIds.value = new Set()
  loadData()
}

function toggleSource(source) {
  if (source === 'jma') {
    const enabled = selectedSources.value.includes(source)
    selectedSources.value = enabled
      ? selectedSources.value.filter(item => item !== source)
      : [...selectedSources.value, source]
    if (enabled) events.value = events.value.filter(eq => eq.source !== 'JMA')
    nextTick().then(renderMarkers)
    return
  }

  selectedSources.value = selectedSources.value.includes(source)
    ? selectedSources.value.filter(item => item !== source)
    : [...selectedSources.value, source]
  lastFetchTime = 0
  suppressNextFreshAlerts = true
  newAlerts.value = []
  newIds.value = new Set()
  loadData()
}

function resetView() {
  if (!map) return
  selectedEvent.value = null
  map.setView([20, 0], 2, { animate: true })
}

onMounted(() => {
  checkMobile()
  initMap()
  loadData()
  connectP2PQuake()
  pollTimer = setInterval(loadData, CATALOG_POLL_MS)
  window.addEventListener('resize', checkMobile)
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (resizeObserver) resizeObserver.disconnect()
  if (p2pSocket) {
    p2pSocket.onclose = null
    p2pSocket.close()
  }
  alertTimers.forEach(clearTimeout)
  window.removeEventListener('resize', checkMobile)
})
</script>

<style>
.app {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #e0e0e0;
  height: 100vh;
  height: 100dvh;
  display: flex;
  position: relative;
}
.icon-btn {
  appearance: none;
  -webkit-tap-highlight-color: transparent;
}
.stats-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  min-height: 46px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(15, 18, 29, 0.94);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.stats-title {
  font-size: 18px;
  font-weight: 760;
  display: flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}
.brand-mark {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #9ee7ff 0 22%, #4da6ff 23% 50%, #1f6f55 51% 75%, #14384a 76%);
  box-shadow: 0 0 16px rgba(77,166,255,0.45);
}
.stats-info {
  display: flex;
  gap: 6px;
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
  min-width: 0;
}
.stat-badge {
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 6px;
  background: rgba(255,255,255,0.075);
  color: #d1d7e6;
  font-size: 12px;
  white-space: nowrap;
}
.stat-label {
  color: #7e879d;
  font-size: 10px;
  font-weight: 650;
  text-transform: uppercase;
}
.stat-badge.stat-m5 { color: #ffaa00; background: rgba(255,170,0,0.1); }
.stat-badge.stat-m7 { color: #ff4444; background: rgba(255,68,68,0.1); }
.stat-badge.stat-time { color: #888; }
.stat-live { font-weight: 750; }
.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8f8f8f;
}
.stat-live.live .live-dot {
  background: #62ff73;
  box-shadow: 0 0 10px rgba(98,255,115,0.65);
}
.hamburger {
  display: none;
  position: relative;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  background: rgba(255,255,255,0.07);
  color: #e8eefc;
  cursor: pointer;
}
.hamburger-badge {
  position: absolute;
  top: -4px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ff6600;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}
.reset-btn {
  position: absolute;
  right: 10px;
  bottom: 80px;
  z-index: 1001;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(18,22,34,0.9);
  color: #d5dced;
  cursor: pointer;
}
.alert-bar {
  position: absolute;
  top: 46px;
  left: 42px;
  right: 0;
  z-index: 1000;
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 6px 14px;
  background: rgba(40,20,10,0.95);
  border-bottom: 1px solid rgba(255,136,0,0.2);
  animation: alertSlideIn 0.3s ease;
  transition: left 0.3s ease;
}
.alert-bar.shifted { left: 320px; }
.alert-item {
  font-size: 12px;
  color: #ffcc88;
  white-space: nowrap;
}
@keyframes alertSlideIn {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}
.sidebar {
  position: absolute;
  top: 46px;
  left: 0;
  bottom: 0;
  z-index: 999;
  width: 320px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(15,18,31,0.95);
  backdrop-filter: blur(12px);
  border-right: 1px solid rgba(255,255,255,0.08);
  transition: transform 0.3s ease, width 0.3s ease, opacity 0.2s ease;
}
.sidebar.collapsed { width: 42px; }
.sidebar-header {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 10px 9px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.sidebar-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 720;
  white-space: nowrap;
}
.sidebar-header p {
  margin: 3px 0 0;
  color: #7f879b;
  font-size: 11px;
}
.sidebar.collapsed .sidebar-header {
  justify-content: center;
  padding: 8px 0;
}
.sidebar.collapsed .sidebar-header h3,
.sidebar.collapsed .sidebar-header p {
  display: none;
}
.toggle-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.06);
  color: #cbd3e3;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}
.sidebar-filters {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 8px;
}
.filter-field { min-width: 0; }
.source-field,
.layer-field,
.quick-field { grid-column: 1 / -1; }
.select-label {
  display: block;
  margin-bottom: 5px;
  color: #7f879b;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}
.filter-select {
  width: 100%;
  padding: 7px 9px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.07);
  color: #d6dbea;
  font-size: 12px;
}
.source-toggles {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.source-toggle,
.quick-action {
  min-height: 30px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.06);
  color: #d7dfef;
  font-size: 12px;
  cursor: pointer;
}
.source-toggle {
  min-height: 26px;
  color: #9fa8ba;
  font-size: 11px;
  padding: 4px 8px;
}
.source-toggle.active {
  color: #77bdff;
  border-color: rgba(77,166,255,0.35);
  background: rgba(77,166,255,0.13);
}
.layer-toggle {
  width: 100%;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.06);
  color: #cbd3e3;
  font-size: 12px;
  cursor: pointer;
}
.layer-toggle.active {
  color: #8fe7ff;
  border-color: rgba(55,212,216,0.42);
  background: rgba(55,212,216,0.11);
}
.toggle-dot {
  width: 18px;
  height: 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.18);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
  position: relative;
}
.toggle-dot::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9aa4b6;
  transition: transform 0.16s ease, background 0.16s ease;
}
.layer-toggle.active .toggle-dot::after {
  transform: translateX(8px);
  background: #8ef6ff;
}
.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.quick-action:disabled {
  opacity: 0.45;
  cursor: default;
}
.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
  -webkit-overflow-scrolling: touch;
}
.list-limit-note {
  margin: 4px 4px 8px;
  padding: 8px 9px;
  border-radius: 7px;
  background: rgba(77,166,255,0.08);
  border: 1px solid rgba(77,166,255,0.16);
  color: #9fb4cf;
  font-size: 11px;
  line-height: 1.35;
}
.event-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;
  padding: 8px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.event-card:hover {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.1);
}
.event-card.significant { border-left: 3px solid #ff8800; padding-left: 5px; }
.event-card.major { border-left: 3px solid #ff2222; padding-left: 5px; }
.mag-badge {
  min-width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  text-shadow: 0 1px 2px rgba(0,0,0,0.4);
}
.event-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.event-place {
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
}
.event-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  color: #888;
  font-size: 10px;
}
.event-mmi { font-weight: 600; }
.empty-state {
  padding: 40px 20px;
  color: #666;
  font-size: 14px;
  text-align: center;
}
.map-container {
  flex: 1;
  height: 100%;
  z-index: 1;
  touch-action: none;
}
.detail-panel {
  position: absolute;
  bottom: 30px;
  left: 60px;
  z-index: 1000;
  max-width: 320px;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(15,18,31,0.95);
  backdrop-filter: blur(14px);
  transition: left 0.3s ease;
}
.detail-panel.shifted { left: 340px; }
.detail-close {
  position: absolute;
  top: 8px;
  right: 10px;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #888;
  cursor: pointer;
}
.detail-mag {
  margin-bottom: 2px;
  font-size: 36px;
  font-weight: 800;
}
.detail-place {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
}
.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.detail-label {
  color: #888;
  font-size: 11px;
}
.detail-value {
  font-size: 12px;
  font-weight: 500;
  text-align: right;
}
.danger { color: #ff4444; }
.legend-panel {
  position: absolute;
  right: 58px;
  bottom: 30px;
  z-index: 1000;
  display: flex;
  gap: 16px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(15,18,31,0.9);
  backdrop-filter: blur(10px);
  font-size: 11px;
}
.legend-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.legend-title {
  margin-bottom: 4px;
  color: #ccc;
  font-size: 11px;
  font-weight: 700;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.legend-dot.depth-ring {
  background: rgba(255,255,255,0.04);
  border: 2px solid currentColor;
}
.legend-label {
  color: #999;
  font-size: 10px;
}
.leaflet-marker-pane .marker-new {
  animation: markerGlow 1.5s ease-in-out infinite;
}
@keyframes markerGlow {
  0%, 100% { filter: drop-shadow(0 0 4px #ffcc00); }
  50% { filter: drop-shadow(0 0 12px #ff6600); }
}
.leaflet-popup-content-wrapper {
  background: #1e1e36 !important;
  color: #e0e0e0 !important;
  border-radius: 10px !important;
  border: 1px solid rgba(255,255,255,0.1);
}
.leaflet-popup-tip { background: #1e1e36 !important; }
.leaflet-popup-close-button { color: #aaa !important; }
.leaflet-control-zoom a {
  background: #1e1e36 !important;
  color: #e0e0e0 !important;
  border-color: rgba(255,255,255,0.1) !important;
}
.leaflet-bottom.leaflet-right .leaflet-control-zoom {
  margin-right: 10px !important;
  margin-bottom: 126px !important;
}
.leaflet-control-attribution {
  background: rgba(22,22,42,0.7) !important;
  color: #666 !important;
  font-size: 10px !important;
}
.leaflet-control-attribution a { color: #888 !important; }
.leaflet-tooltip {
  background: rgba(22,22,42,0.9) !important;
  color: #e0e0e0 !important;
  border: 1px solid rgba(255,255,255,0.1) !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  padding: 4px 8px !important;
}
.sidebar-backdrop {
  display: none;
  position: absolute;
  inset: 0;
  z-index: 998;
  background: rgba(0,0,0,0.5);
}

@media (max-width: 767px) {
  .stats-bar {
    min-height: 50px;
    padding: 6px 7px;
    gap: 5px;
    flex-wrap: nowrap;
  }
  .hamburger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
  }
  .stats-title {
    font-size: 14px;
    gap: 5px;
  }
  .brand-mark {
    width: 13px;
    height: 13px;
  }
  .stats-info {
    flex: 0 1 auto;
    overflow: hidden;
    gap: 4px;
  }
  .stat-badge {
    min-height: 20px;
    padding: 2px 6px;
    border-radius: 5px;
    font-size: 11px;
  }
  .stat-label { display: none; }
  .stat-count .stat-label,
  .stat-m5 .stat-label,
  .stat-m7 .stat-label {
    display: inline;
    font-size: 9px;
  }
  .stat-badge.stat-window,
  .stat-badge.stat-time,
  .stat-badge.stat-source {
    display: none;
  }
  .sidebar {
    top: 0;
    bottom: 0;
    width: min(92vw, 360px);
    z-index: 1002;
    transform: translateX(-100%);
    border-radius: 0 12px 12px 0;
    box-shadow: 4px 0 24px rgba(0,0,0,0.5);
  }
  .sidebar.mobile-open {
    transform: translateX(0);
    opacity: 1;
  }
  .sidebar.mobile-hidden {
    transform: translateX(-100%);
    visibility: hidden;
    pointer-events: none;
  }
  .sidebar.collapsed { width: 0; }
  .sidebar-backdrop {
    display: block;
    z-index: 1001;
  }
  .sidebar-header {
    min-height: 58px;
    padding: 10px 10px 10px 12px;
  }
  .toggle-btn {
    width: 34px;
    height: 34px;
  }
  .sidebar-filters {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    padding: 10px;
    gap: 10px;
  }
  .filter-select {
    min-height: 40px;
    font-size: 13px;
  }
  .source-toggles {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }
  .source-toggles::-webkit-scrollbar { display: none; }
  .source-toggle {
    flex: 0 0 auto;
    min-height: 34px;
    padding: 6px 9px;
    font-size: 12px;
  }
  .quick-action {
    min-height: 38px;
    font-size: 13px;
  }
  .event-card {
    min-height: 58px;
    padding: 9px 8px;
  }
  .mag-badge {
    min-width: 42px;
    height: 42px;
  }
  .alert-bar {
    top: 50px;
    left: 0;
    z-index: 997;
    padding: 4px 8px;
    gap: 8px;
  }
  .alert-bar.shifted { left: 0; }
  .alert-item { font-size: 11px; }
  .detail-panel {
    left: 10px;
    right: 10px;
    bottom: max(10px, env(safe-area-inset-bottom));
    max-width: none;
    max-height: 44dvh;
    overflow: auto;
    border-radius: 10px 10px 4px 4px;
  }
  .detail-panel.shifted { left: 10px; }
  .detail-mag { font-size: 28px; }
  .detail-close {
    width: 34px;
    height: 34px;
  }
  .legend-panel {
    top: 58px;
    right: 8px;
    bottom: auto;
    left: auto;
    flex-direction: column;
    gap: 0;
    padding: 0;
    border-radius: 8px;
    font-size: 10px;
  }
  .legend-panel.open {
    right: 4px;
    max-width: 75vw;
    flex-direction: row;
    gap: 8px;
    padding: 6px 8px;
  }
  .legend-toggle {
    width: 36px;
    height: 36px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 7px;
    background: rgba(15,18,31,0.9);
    color: #d8deec;
  }
  .legend-title {
    margin-bottom: 2px;
    font-size: 10px;
  }
  .legend-dot {
    width: 8px;
    height: 8px;
  }
  .legend-label { font-size: 9px; }
  .reset-btn {
    width: 38px;
    height: 38px;
    right: 10px;
    bottom: 78px;
  }
  .leaflet-control-zoom { display: none !important; }
  .leaflet-tooltip {
    font-size: 11px !important;
    padding: 3px 6px !important;
  }
}

@media (min-width: 768px) and (max-width: 1024px) {
  .sidebar { width: 280px; }
  .alert-bar.shifted { left: 280px; }
  .detail-panel.shifted { left: 300px; }
  .stat-badge.stat-time { display: none; }
  .stat-badge.stat-source {
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
