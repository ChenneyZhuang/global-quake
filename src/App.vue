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
        <span v-if="selectedSources.includes('jma')" class="stat-badge stat-jma" :class="{ live: p2pConnected }">
          <span class="stat-label">Japan</span>{{ p2pConnected ? 'JMA live' : 'JMA connecting' }}
        </span>
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
        <span v-if="alert.source === 'JMA'" class="alert-tag">Japan live</span>
        {{ alert.place || 'Unknown location' }} · {{ timeAgo(alert.time) }}
      </span>
    </div>

    <section v-if="showStrongMotionLayer" class="strong-motion-panel" :class="{ mobile: isMobile }">
      <div class="strong-motion-head">
        <div>
          <div class="strong-motion-title">NIED Strong-motion Monitor</div>
          <div class="strong-motion-time">{{ strongMotionStatusLabel }}</div>
        </div>
        <button class="strong-motion-close icon-btn" type="button" aria-label="Hide Japan sensors" @click="toggleStrongMotionLayer">x</button>
      </div>
      <div class="strong-motion-frame">
        <img v-if="strongMotionImageUrl" :src="strongMotionImageUrl" alt="NIED realtime seismic intensity monitor">
        <div v-else class="strong-motion-state">{{ strongMotionStatusLabel }}</div>
      </div>
    </section>

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
              :class="{
                active: selectedSources.includes(source.key),
                'source-error': sourceHealth[source.key] === 'error',
                'source-empty': sourceHealth[source.key] === 'empty',
              }"
              :aria-pressed="selectedSources.includes(source.key)"
              :title="sourceHealthText(source.key)"
              @click="toggleSource(source.key)"
            >
              {{ source.label }}
            </button>
          </div>
        </div>
        <div class="filter-field layer-field">
          <div class="select-label">Map layers</div>
          <div class="option-stack">
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
            <button
              type="button"
              class="layer-toggle"
              :class="{ active: showStrongMotionLayer }"
              :aria-pressed="showStrongMotionLayer"
              @click="toggleStrongMotionLayer"
            >
              <span class="toggle-dot" aria-hidden="true"></span>
              Japan sensors
              <span class="layer-status">{{ strongMotionStatusLabel }}</span>
            </button>
            <button
              type="button"
              class="layer-toggle"
              :class="{ active: audioAlertsEnabled }"
              :aria-pressed="audioAlertsEnabled"
              @click="toggleAudioAlerts"
            >
              <span class="toggle-dot" aria-hidden="true"></span>
              M5+ sound
            </button>
            <button
              type="button"
              class="layer-toggle"
              :class="{ active: liveFocusEnabled }"
              :aria-pressed="liveFocusEnabled"
              @click="liveFocusEnabled = !liveFocusEnabled"
            >
              <span class="toggle-dot" aria-hidden="true"></span>
              Live focus M5+
            </button>
            <button
              type="button"
              class="layer-toggle"
              :class="{ active: locateEnabled }"
              :aria-pressed="locateEnabled"
              @click="toggleLocate"
            >
              <span class="toggle-dot" aria-hidden="true"></span>
              Wave times for me
            </button>
            <button
              type="button"
              class="layer-toggle"
              :class="{ active: desktopNotificationsEnabled }"
              :aria-pressed="desktopNotificationsEnabled"
              @click="toggleDesktopNotifications"
            >
              <span class="toggle-dot" aria-hidden="true"></span>
              Local notify
            </button>
            <button
              type="button"
              class="layer-toggle"
              :class="{ active: timeMode === 'utc' }"
              :aria-pressed="timeMode === 'utc'"
              @click="toggleTimeMode"
            >
              <span class="toggle-dot" aria-hidden="true"></span>
              UTC time
            </button>
          </div>
        </div>
        <div class="filter-field export-field">
          <div class="select-label">Export</div>
          <div class="export-actions">
            <button type="button" class="quick-action" :disabled="!filteredEvents.length" @click="exportEvents('csv')">
              CSV
            </button>
            <button type="button" class="quick-action" :disabled="!filteredEvents.length" @click="exportEvents('geojson')">
              GeoJSON
            </button>
          </div>
        </div>
        <div class="filter-field replay-field">
          <div class="select-label">Historical replay</div>
          <div class="replay-box" :class="{ active: replayEnabled }">
            <div class="replay-row">
              <button
                type="button"
                class="layer-toggle replay-main"
                :class="{ active: replayEnabled }"
                :aria-pressed="replayEnabled"
                @click="toggleReplay"
              >
                <span class="toggle-dot" aria-hidden="true"></span>
                Replay mode
              </button>
              <button type="button" class="quick-action replay-play" :disabled="!replayEnabled || !baseFilteredEvents.length" @click="toggleReplayPlayback">
                {{ replayPlaying ? 'Pause' : 'Play' }}
              </button>
            </div>
            <input
              class="replay-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              :value="replayProgress"
              :disabled="!replayEnabled || !baseFilteredEvents.length"
              @input="setReplayProgress($event.target.value)"
            >
            <div class="replay-meta">
              <span>{{ replayEnabled ? replayTimeLabel : 'Off' }}</span>
              <button type="button" class="mini-link" :disabled="!replayEnabled" @click="resetReplay">Reset</button>
            </div>
          </div>
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
          Showing {{ displayedEvents.length }} of {{ filteredEvents.length }} events.
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
            <span class="event-place">
              {{ eq.place || 'Unknown location' }}
              <span v-if="eq.tsunami" class="event-flag" :class="{ danger: eq.tsunami !== 'None' }">
                Tsunami {{ eq.tsunami }}
              </span>
            </span>
            <span class="event-meta">
            <span class="event-source" :class="{ multi: sourceCount(eq.source) > 1 }">
              {{ eq.source }}
              <span
                v-if="sourceCount(eq.source) > 1"
                class="confirm-badge"
                title="Confirmed by multiple independent catalogs"
              >
                ✓{{ sourceCount(eq.source) }}
              </span>
            </span>
              <span>{{ eq.depth?.toFixed(0) || '?' }}km</span>
              <span v-if="eq.intensityLabel" class="event-mmi" :style="{ color: mmiColor(eq.mmi) }">{{ eq.intensityLabel }}</span>
              <span v-else-if="eq.mmi != null" class="event-mmi" :style="{ color: mmiColor(eq.mmi) }">MMI {{ romanMmi(eq.mmi) }}</span>
              <span>{{ timeAgo(eq.time) }}</span>
            </span>
          </span>
        </button>
        <button
          v-if="hiddenEventCount > 0"
          type="button"
          class="load-more"
          @click="loadMoreEvents"
        >
          Load {{ Math.min(LIST_PAGE_SIZE, hiddenEventCount) }} more
          <span class="load-more-remaining">({{ hiddenEventCount }} remaining)</span>
        </button>
        <button
          v-else-if="displayedEvents.length > LIST_PAGE_SIZE"
          type="button"
          class="load-more subtle"
          @click="collapseEventList"
        >
          Collapse list
        </button>
        <div v-if="filteredEvents.length === 0" class="empty-state">
          {{ events.length ? 'No events match filter' : 'Loading earthquake data...' }}
        </div>
      </div>
    </aside>

    <div v-if="isMobile && mobileSidebarOpen" class="sidebar-backdrop" @click="mobileSidebarOpen = false"></div>

    <main ref="mapContainer" class="map-container"></main>

    <section v-if="selectedEvent && !liveFocusEvent" class="detail-panel" :class="{ shifted: !sidebarCollapsed && !isMobile }">
      <button class="detail-close icon-btn" type="button" aria-label="Close event details" @click="selectedEvent = null">x</button>
      <div class="detail-mag" :style="{ color: magColor(selectedEvent.mag) }">M{{ formatMag(selectedEvent.mag) }}</div>
      <div class="detail-place">{{ selectedEvent.place || 'Unknown location' }}</div>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Time</span>
          <span class="detail-value">{{ formatEventTime(selectedEvent.time) }}</span>
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
          <span class="detail-value">
            {{ selectedEvent.source }}
            <span v-if="sourceCount(selectedEvent.source) > 1" class="confirm-badge inline">
              ✓ cross-checked by {{ sourceCount(selectedEvent.source) }} catalogs
            </span>
          </span>
        </div>
        <div v-if="selectedEvent.felt" class="detail-item">
          <span class="detail-label">Felt reports</span>
          <span class="detail-value">{{ selectedEvent.felt }}</span>
        </div>
        <div v-if="selectedEvent.cdi" class="detail-item">
          <span class="detail-label">Community intensity</span>
          <span class="detail-value" :style="{ color: mmiColor(Math.min(selectedEvent.cdi, 10)) }">
            MMI {{ romanMmi(Math.min(selectedEvent.cdi, 10)) }}
          </span>
        </div>
        <div v-if="selectedEvent.intensityLabel" class="detail-item">
          <span class="detail-label">JMA intensity</span>
          <span class="detail-value" :style="{ color: mmiColor(selectedEvent.mmi) }">
            {{ selectedEvent.intensityLabel }}
          </span>
        </div>
        <div v-if="selectedEvent.detail || selectedEvent.url" class="detail-action-row">
          <button type="button" class="detail-action" @click="loadShakeMap(selectedEvent)">
            MMI ShakeMap
          </button>
          <a v-if="selectedEvent.url" class="detail-action" :href="selectedEvent.url" target="_blank" rel="noopener noreferrer">Source page</a>
        </div>
        <div v-if="selectedEvent.tsunami" class="detail-item">
          <span class="detail-label">Tsunami</span>
          <span class="detail-value danger">{{ selectedEvent.tsunami }}</span>
        </div>
      </div>
    </section>

    <section v-if="shakeMap.open" class="shakemap-panel" :class="{ shifted: !sidebarCollapsed && !isMobile }">
      <button class="detail-close icon-btn" type="button" aria-label="Close ShakeMap" @click="closeShakeMap">x</button>
      <div class="shakemap-title">MMI ShakeMap</div>
      <div class="shakemap-subtitle">{{ shakeMap.place || 'Selected event' }}</div>
      <div v-if="shakeMap.loading" class="shakemap-state">Loading ShakeMap...</div>
      <div v-else-if="shakeMap.error" class="shakemap-state">{{ shakeMap.error }}</div>
      <a v-else-if="shakeMap.imageUrl" :href="shakeMap.productUrl || shakeMap.imageUrl" target="_blank" rel="noopener noreferrer">
        <img class="shakemap-image" :src="shakeMap.imageUrl" alt="USGS ShakeMap intensity image">
      </a>
      <div v-if="shakeMap.productUrl" class="shakemap-links">
        <a :href="shakeMap.productUrl" target="_blank" rel="noopener noreferrer">Open USGS product</a>
      </div>
    </section>

    <section v-if="liveFocusEvent" class="broadcast-panel" :class="{ shifted: !sidebarCollapsed && !isMobile }">
      <div class="broadcast-kicker">
        <span class="broadcast-live-dot" aria-hidden="true"></span>
        Major earthquake detected
      </div>
      <div class="broadcast-main">
        <div class="broadcast-mag-stack">
          <span class="broadcast-mag-label">Magnitude</span>
          <span class="broadcast-mag" :style="{ color: magColor(liveFocusEvent.mag) }">
            {{ formatMag(liveFocusEvent.mag) }}
          </span>
        </div>
        <div class="broadcast-intensity">
          <span class="broadcast-mag-label">Impact</span>
          <span class="broadcast-intensity-value" :style="{ background: intensityColor(estimatedIntensity(liveFocusEvent)) }">
            {{ estimatedIntensityLabel(liveFocusEvent) }}
          </span>
        </div>
        <div class="broadcast-info">
          <div class="broadcast-place">{{ liveFocusEvent.place || 'Unknown location' }}</div>
          <div class="broadcast-message">{{ liveFocusMessage(liveFocusEvent) }}</div>
          <div class="broadcast-meta">
            <span>{{ formatEventTime(liveFocusEvent.time) }}</span>
            <span>{{ liveFocusEvent.depth?.toFixed(1) || '?' }} km deep</span>
            <span>{{ liveFocusEvent.source || 'Unknown source' }}</span>
          </div>
        </div>
      </div>
      <button class="broadcast-close icon-btn" type="button" aria-label="Close live focus" @click="clearLiveFocus">x</button>
    </section>

    <section
      v-if="eew"
      class="eew-panel"
      :class="{ cancelled: eew.cancelled, shifted: !sidebarCollapsed && !isMobile }"
      aria-live="polite"
    >
      <div class="eew-head">
        <span class="eew-pulse" aria-hidden="true"></span>
        <span class="eew-title">Japan Earthquake Early Warning</span>
        <span v-if="eew.cancelled" class="eew-cancelled">Cancelled</span>
        <button class="icon-btn eew-close" type="button" aria-label="Dismiss early warning" @click="eew = null">x</button>
      </div>

      <div class="eew-main">
        <div class="eew-intensity">
          <span class="eew-intensity-label">Max shaking</span>
          <span class="eew-intensity-value" :style="{ background: mmiColor(eew.maxMmi) }">
            {{ eew.maxMmi > 0 ? (eew.areas[0]?.intensityLabel || `MMI ${romanMmi(eew.maxMmi)}`) : '—' }}
          </span>
        </div>
        <div class="eew-meta">
          <span v-if="eew.place">{{ eew.place }}</span>
          <span>{{ eew.depth?.toFixed(0) || '?' }}km deep</span>
          <span>{{ eew.areas.length }} area{{ eew.areas.length === 1 ? '' : 's' }} reported</span>
        </div>
      </div>

      <ul v-if="eew.areas.length" class="eew-areas">
        <li v-for="area in eew.areas.slice(0, 6)" :key="area.name" class="eew-area">
          <span class="eew-area-name">{{ area.name }}</span>
          <span class="eew-area-scale" :style="{ color: mmiColor(area.mmi) }">
            {{ area.intensityLabel }}
          </span>
        </li>
      </ul>

      <p class="eew-notice">
        Live information relayed by P2PQuake, not a certified earthquake early-warning service.
      </p>
    </section>

    <section
      v-if="waveStatus"
      class="wave-panel"
      :class="{ unavailable: waveStatus.status === 'unavailable' }"
      aria-live="polite"
    >
      <template v-if="waveStatus.status === 'unavailable'">
        <div class="wave-head">
          <span class="wave-title">Wave times unavailable</span>
        </div>
        <div class="wave-note">{{ waveStatus.note }}</div>
      </template>
      <template v-else>
        <div class="wave-head">
          <span class="wave-title">Wave times for you</span>
          <span class="wave-distance">{{ waveStatus.distanceKm.toFixed(0) }} km away</span>
        </div>
        <div class="wave-note">{{ waveStatus.note }}</div>
        <div class="wave-bars">
          <div class="wave-bar">
            <span class="wave-bar-label">P wave</span>
            <span class="wave-track">
              <span
                class="wave-fill wave-p"
                :style="{ width: Math.min(100, (waveStatus.elapsedSec / waveStatus.pSec) * 100) + '%' }"
              ></span>
            </span>
          </div>
          <div class="wave-bar">
            <span class="wave-bar-label">S wave</span>
            <span class="wave-track">
              <span
                class="wave-fill wave-s"
                :style="{ width: Math.min(100, (waveStatus.elapsedSec / waveStatus.sSec) * 100) + '%' }"
              ></span>
            </span>
          </div>
        </div>
        <p class="eew-notice">
          Estimated with uniform wave speeds. Accuracy depends on your location permission and
          the quake's age — this is not an early-warning service.
        </p>
      </template>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  fetchEMSC,
  fetchGFZ,
  fetchGeoNet,
  fetchUSGS,
  depthColor,
  formatMag,
  jmaScaleToIntensity,
  normalizeEvent,
  P2P_QUAKE_MSG,
  P2PQUAKE_WS,
  timeAgo,
} from './utils/api.js'

const catalogWindows = [
  { key: 'all_hour', label: 'Past hour', hours: 1 },
  { key: 'all_day', label: 'Past 24 hours', hours: 24 },
  { key: 'all_week', label: 'Past 7 days', hours: 24 * 7 },
  // Same 7-day window but filtered to M4.5+ at the source: 57 KB instead of
  // 1.5 MB. Already fetched by key name, just never exposed in the UI.
  { key: '4.5_week', label: 'M4.5+ past 7 days', hours: 24 * 7 },
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
const showStrongMotionLayer = ref(false)
const strongMotionStatus = ref('idle')
const strongMotionTimestamp = ref('')
const strongMotionImageUrl = ref('')
const audioAlertsEnabled = ref(false)
const liveFocusEnabled = ref(true)
const desktopNotificationsEnabled = ref(false)
const timeMode = ref('local')
const replayEnabled = ref(false)
const replayPlaying = ref(false)
const replayProgress = ref(100)
const sidebarCollapsed = ref(true)
const mobileSidebarOpen = ref(false)
const legendOpen = ref(false)
const isMobile = ref(false)
// Japan earthquake early-warning bulletin (P2PQuake code 556). This is live
// information, not a certified EEW service — see the notice in the panel.
const eew = ref(null)
const eewHistory = ref([])
// Per-source health so a dead source is visible instead of silently showing
// zero events while still being listed as active.
const sourceHealth = ref({ usgs: 'idle', emsc: 'idle', gfz: 'idle', geonet: 'idle', jma: 'idle' })
// Per-source timestamp of the last successful fetch, used to detect a source
// that has gone stale (no data for several poll cycles) rather than only one
// that threw an exception.
const sourceLastOk = ref({ usgs: 0, emsc: 0, gfz: 0, geonet: 0 })
// Optional geolocation, used only to turn the raw P/S wave speeds into an
// arrival countdown for the user. Off by default — nothing is requested until
// the user opts in.
const locateEnabled = ref(false)
const userLocation = ref(null)
const waveStatus = ref(null)
const p2pConnected = ref(false)
const shakeMap = ref({
  open: false,
  loading: false,
  place: '',
  imageUrl: '',
  productUrl: '',
  error: '',
})
const liveFocusEvent = ref(null)

let map = null
let markerLayer = null
let effectLayer = null
let epicenterEffectMarker = null
let strongMotionTimer = null
let strongMotionLastUrl = ''
let strongMotionPreferredDelayMs = 30_000
let pWaveCircle = null
let sWaveCircle = null
let seismicWaveTimer = null
let mapRenderer = null
let resizeObserver = null
let pollTimer = null
let p2pSocket = null
let p2pReconnectTimer = null
let lastFetchTime = 0
let loadRequestId = 0
let initialLoadDone = false
let suppressNextFreshAlerts = false
let knownIds = new Set()
// knownIds only ever grew, so a long-lived tab accumulated every event id ever
// seen. Cap it and drop the oldest entries on overflow.
const KNOWN_IDS_MAX = 20_000

function rememberId(id, set) {
  if (set === knownIds && set.size >= KNOWN_IDS_MAX) {
    // Set preserves insertion order, so the first values are the oldest.
    const excess = set.size - KNOWN_IDS_MAX + 1
    let dropped = 0
    for (const old of set) {
      set.delete(old)
      if (++dropped >= excess) break
    }
  }
  set.add(id)
}
let alertTimers = []
let audioContext = null
let lastAudioAlertAt = 0
let replayTimer = null
let liveFocusTimer = null
const feedCache = new Map()
// Raw USGS FeatureCollections keyed by feed, so a 304 Not Modified can reuse
// the previous payload instead of re-downloading up to 1.5 MB (all_week).
const rawUsgsCache = new Map()

// --- Settings persistence ---
// Previously every control reset on reload: window, magnitude filter, alert
// toggles, sidebar state, timezone — 20+ values lost on refresh.
const SETTINGS_KEY = 'global-quake:settings:v1'
const persistedRefs = {
  currentFeed,
  selectedSources,
  magFilter,
  showDepthRings,
  audioAlertsEnabled,
  liveFocusEnabled,
  timeMode,
  sidebarCollapsed,
  legendOpen,
}

function loadSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return
    const saved = JSON.parse(raw)
    for (const key of Object.keys(persistedRefs)) {
      if (saved[key] !== undefined) persistedRefs[key].value = saved[key]
    }
  } catch {
    // Corrupt or unavailable storage: start from defaults.
  }
}

let settingsSaveTimer = null
function saveSettings() {
  if (settingsSaveTimer) clearTimeout(settingsSaveTimer)
  settingsSaveTimer = setTimeout(() => {
    try {
      const payload = {}
      for (const key of Object.keys(persistedRefs)) payload[key] = persistedRefs[key].value
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload))
    } catch {
      // Storage quota or privacy mode: settings just won't survive reload.
    }
  }, 150)
}
for (const key of Object.keys(persistedRefs)) {
  watch(persistedRefs[key], saveSettings)
}

// Recompute the P/S wave arrival estimate whenever the selected event changes
// or the user's own location changes.
watch([selectedEvent, userLocation], ([eq]) => {
  waveStatus.value = locateEnabled.value ? computeWaveStatus(eq) : null
}, { immediate: false })

// Cache must outlive the poll interval, otherwise every poll misses the cache
// and re-downloads the full feed (all_week is ~1.5 MB) every single minute.
// Kept slightly above CATALOG_POLL_MS so a normal poll cycle hits the cache.
const FEED_CACHE_MS = 90_000
const CATALOG_POLL_MS = 60_000
const ALERT_EVENT_MAX_AGE_MS = 15 * 60 * 1000
const ALERT_DISPLAY_MS = 15_000
const NEW_MARKER_MS = 30_000
const STRONG_MOTION_POLL_MS = 4_000
const KMONI_IMAGE_TIMEOUT_MS = 3_500
const KMONI_BASE = 'https://www.kmoni.bosai.go.jp/data/map_img/RealTimeImg/jma_s'
// A source that stops delivering for this long is marked stale, not merely
// "not checked yet". Roughly 3x the catalog poll interval.
const STALE_SOURCE_MS = 3 * 60 * 1000
const LOCATE_TIMEOUT_MS = 8_000
const P_WAVE_KM_PER_SEC = 6.0
const S_WAVE_KM_PER_SEC = 3.5

const selectedFeed = computed(() => catalogWindows.find(feed => feed.key === currentFeed.value) || catalogWindows[1])
const selectedFeedLabel = computed(() => selectedFeed.value.label)
const sortedEvents = computed(() => [...events.value].sort((a, b) => b.time - a.time))
const baseFilteredEvents = computed(() => {
  if (magFilter.value <= 0) return sortedEvents.value
  return sortedEvents.value.filter(event => event.mag >= magFilter.value)
})
const replayBounds = computed(() => {
  const items = baseFilteredEvents.value
  if (!items.length) return { start: 0, end: 0, span: 0 }
  const times = items.map(event => event.time).filter(Number.isFinite)
  const start = Math.min(...times)
  const end = Math.max(...times)
  return { start, end, span: Math.max(1, end - start) }
})
const replayTime = computed(() => {
  if (!replayEnabled.value) return replayBounds.value.end
  return replayBounds.value.start + replayBounds.value.span * (replayProgress.value / 100)
})
const replayTimeLabel = computed(() => {
  if (!baseFilteredEvents.value.length) return 'No events'
  return formatEventTime(replayTime.value)
})
const filteredEvents = computed(() => {
  if (!replayEnabled.value) return baseFilteredEvents.value
  return baseFilteredEvents.value.filter(event => event.time <= replayTime.value)
})
const displayedEvents = computed(() => filteredEvents.value.slice(0, listLimit.value))
const hiddenEventCount = computed(() => Math.max(0, filteredEvents.value.length - displayedEvents.value.length))
// How many rows the list renders. Previously hard-coded to 650, which silently
// dropped 70% of a 7-day catalog (all_week returns ~2,240 events). Now the user
// can page through the rest.
const LIST_PAGE_SIZE = 200
const listLimit = ref(LIST_PAGE_SIZE)

function loadMoreEvents() {
  listLimit.value += LIST_PAGE_SIZE
  nextTick().then(renderMarkers)
}

function collapseEventList() {
  listLimit.value = LIST_PAGE_SIZE
}
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
const strongMotionStatusLabel = computed(() => {
  if (!showStrongMotionLayer.value) return 'off'
  if (strongMotionStatus.value === 'live') return strongMotionTimestamp.value || 'live'
  if (strongMotionStatus.value === 'loading') return 'loading'
  if (strongMotionStatus.value === 'unavailable') return 'unavailable'
  return 'standby'
})

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

function intensityColor(intensity) {
  if (intensity == null) return '#667085'
  if (intensity >= 7) return '#b000b8'
  if (intensity >= 6) return '#e51b23'
  if (intensity >= 5) return '#ff7a00'
  if (intensity >= 4) return '#ffd23f'
  if (intensity >= 3) return '#51c878'
  if (intensity >= 2) return '#35a9d8'
  return '#8a95a6'
}

function estimatedIntensity(eq) {
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

function estimatedIntensityLabel(eq) {
  const intensity = estimatedIntensity(eq)
  if (intensity == null) return '?'
  return eq?.mmi != null ? romanMmi(intensity) : `${intensity}`
}

function liveFocusMessage(eq) {
  if (eq?.tsunami) return 'Tsunami flag present. Follow official emergency guidance.'
  if ((eq?.mag ?? 0) >= 7) return 'Strong shaking is possible near the epicenter. Stay alert and check official updates.'
  if ((eq?.mag ?? 0) >= 6) return 'Potentially damaging earthquake. Review nearby conditions and official bulletins.'
  return 'Fresh M5+ earthquake. Monitor updates and be prepared for aftershocks.'
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
        <div>Time: <b>${formatEventTime(eq.time)}</b></div>
        <div>Depth: <b>${eq.depth?.toFixed(1) || '?'} km</b></div>
        <div>Source: <b>${safeSource}</b></div>
        ${eq.mmi != null ? `<div>Max Intensity: <b style="color:${mmiColor(eq.mmi)};">MMI ${romanMmi(eq.mmi)}</b></div>` : ''}
        ${eq.tsunami ? '<div style="color:#ff4444;font-weight:700;">Tsunami Alert</div>' : ''}
      </div>
      ${safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#4da6ff;display:inline-block;margin-top:8px;font-size:12px;">Source detail</a>` : ''}
    </div>
  `
}

function formatEventTime(timestamp) {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return '-'
  if (timeMode.value === 'utc') {
    return `${date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')} UTC`
  }
  return `${date.toLocaleString()} Local`
}

function formatFileStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', 'UTC')
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
  effectLayer = L.layerGroup().addTo(map)
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

function toggleStrongMotionLayer() {
  showStrongMotionLayer.value = !showStrongMotionLayer.value
  if (showStrongMotionLayer.value) {
    startStrongMotionMonitor()
  } else {
    stopStrongMotionMonitor()
  }
}

function startStrongMotionMonitor() {
  if (!map || strongMotionTimer) return
  updateStrongMotionImage()
  strongMotionTimer = setInterval(updateStrongMotionImage, STRONG_MOTION_POLL_MS)
}

function stopStrongMotionMonitor() {
  if (strongMotionTimer) {
    clearInterval(strongMotionTimer)
    strongMotionTimer = null
  }
  strongMotionImageUrl.value = ''
  strongMotionLastUrl = ''
  strongMotionStatus.value = 'idle'
  strongMotionTimestamp.value = ''
}

async function updateStrongMotionImage() {
  if (!map || !showStrongMotionLayer.value) return
  strongMotionStatus.value = strongMotionImageUrl.value ? 'live' : 'loading'
  const delays = uniqueDelays([
    strongMotionPreferredDelayMs,
    8_000,
    15_000,
    30_000,
    45_000,
    60_000,
    90_000,
  ])

  for (const delay of delays) {
    const timestamp = kmoniTimestamp(Date.now() - delay)
    const url = kmoniRealtimeIntensityUrl(timestamp)
    if (url === strongMotionLastUrl) {
      strongMotionStatus.value = 'live'
      return
    }
    const ok = await preloadImage(url, KMONI_IMAGE_TIMEOUT_MS)
    if (!ok || !showStrongMotionLayer.value) continue
    strongMotionPreferredDelayMs = delay
    setStrongMotionImage(url, timestamp)
    return
  }

  strongMotionStatus.value = strongMotionImageUrl.value ? 'live' : 'unavailable'
}

function setStrongMotionImage(url, timestamp) {
  strongMotionImageUrl.value = url
  strongMotionLastUrl = url
  strongMotionTimestamp.value = formatKmoniDisplayTime(timestamp)
  strongMotionStatus.value = 'live'
}

function uniqueDelays(delays) {
  return [...new Set(delays.filter(delay => Number.isFinite(delay) && delay > 0))]
}

function kmoniRealtimeIntensityUrl(timestamp) {
  return `${KMONI_BASE}/${timestamp.slice(0, 8)}/${timestamp}.jma_s.gif`
}

function kmoniTimestamp(ms) {
  const date = new Date(ms + 9 * 60 * 60 * 1000)
  const pad = value => String(value).padStart(2, '0')
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('')
}

function formatKmoniDisplayTime(timestamp) {
  if (!timestamp || timestamp.length !== 14) return 'live'
  return `${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)} JST`
}

function preloadImage(url, timeoutMs) {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    const finish = value => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => finish(false), timeoutMs)
    image.onload = () => finish(true)
    image.onerror = () => finish(false)
    image.src = url
  })
}

function toggleTimeMode() {
  timeMode.value = timeMode.value === 'local' ? 'utc' : 'local'
}

function toggleReplay() {
  replayEnabled.value = !replayEnabled.value
  if (replayEnabled.value) {
    replayProgress.value = 0
  } else {
    stopReplayPlayback()
    replayProgress.value = 100
  }
  nextTick().then(renderMarkers)
}

function setReplayProgress(value) {
  replayProgress.value = Math.max(0, Math.min(100, Number(value) || 0))
  nextTick().then(renderMarkers)
}

function toggleReplayPlayback() {
  if (!replayEnabled.value || !baseFilteredEvents.value.length) return
  if (replayPlaying.value) {
    stopReplayPlayback()
    return
  }
  replayPlaying.value = true
  replayTimer = setInterval(() => {
    const next = replayProgress.value + 1
    if (next >= 100) {
      replayProgress.value = 100
      stopReplayPlayback()
    } else {
      replayProgress.value = next
    }
    nextTick().then(renderMarkers)
  }, 550)
}

function stopReplayPlayback() {
  replayPlaying.value = false
  if (replayTimer) {
    clearInterval(replayTimer)
    replayTimer = null
  }
}

function resetReplay() {
  stopReplayPlayback()
  replayProgress.value = 0
  nextTick().then(renderMarkers)
}

async function toggleAudioAlerts() {
  audioAlertsEnabled.value = !audioAlertsEnabled.value
  if (audioAlertsEnabled.value) {
    await ensureAudioContext()
    playAudioAlert('test')
  }
}

async function toggleDesktopNotifications() {
  if (!('Notification' in window)) {
    desktopNotificationsEnabled.value = false
    return
  }
  if (desktopNotificationsEnabled.value) {
    desktopNotificationsEnabled.value = false
    return
  }
  if (Notification.permission === 'granted') {
    desktopNotificationsEnabled.value = true
    return
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    desktopNotificationsEnabled.value = permission === 'granted'
  }
}

async function ensureAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      audioAlertsEnabled.value = false
      return null
    }
    audioContext = new AudioContextClass()
  }
  if (audioContext.state === 'suspended') await audioContext.resume()
  return audioContext
}

async function playAudioAlert(kind = 'alert') {
  if (!audioAlertsEnabled.value) return
  const context = await ensureAudioContext()
  if (!context) return

  const now = context.currentTime
  const volume = context.createGain()
  volume.gain.setValueAtTime(0.0001, now)
  volume.gain.exponentialRampToValueAtTime(kind === 'test' ? 0.035 : 0.055, now + 0.02)
  volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
  volume.connect(context.destination)

  const tones = kind === 'test' ? [660] : [740, 980]
  tones.forEach((frequency, index) => {
    const start = now + index * 0.18
    const oscillator = context.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.connect(volume)
    oscillator.start(start)
    oscillator.stop(start + 0.16)
  })
}

function playFreshEventAudio(items) {
  if (!audioAlertsEnabled.value) return
  if (!items.some(eq => eq.mag >= 5)) return
  const now = Date.now()
  if (now - lastAudioAlertAt < 10_000) return
  lastAudioAlertAt = now
  playAudioAlert('alert')
}

function sendFreshEventNotification(items) {
  if (!desktopNotificationsEnabled.value || !('Notification' in window) || Notification.permission !== 'granted') return
  const event = [...items].sort((a, b) => (b.mag ?? -1) - (a.mag ?? -1))[0]
  if (!event || event.mag < 5) return
  const title = `M${formatMag(event.mag)} earthquake`
  const body = `${event.place || 'Unknown location'} · ${timeAgo(event.time)} · ${event.source || 'Unknown source'}`
  const notification = new Notification(title, {
    body,
    tag: String(event.id || event.time),
    renotify: false,
    silent: audioAlertsEnabled.value,
  })
  notification.onclick = () => {
    window.focus()
    focusEvent(event)
    notification.close()
  }
}

function speakFreshEventAlert(event) {
  if (!audioAlertsEnabled.value || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return
  const mag = formatMag(event.mag)
  const place = event.place || 'unknown location'
  const text = `检测到强震。震级 ${mag}，位置 ${place}。请注意安全，并以官方信息为准。`
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.95
    utterance.pitch = 0.92
    utterance.volume = 0.9
    window.speechSynthesis.speak(utterance)
  } catch {
    // Speech synthesis is best-effort; visual and tone alerts still run.
  }
}

function exportEvents(format) {
  const items = filteredEvents.value
  if (!items.length) return
  const stamp = formatFileStamp()
  if (format === 'geojson') {
    downloadText(
      `global-quake-${stamp}.geojson`,
      JSON.stringify(toGeoJson(items), null, 2),
      'application/geo+json'
    )
    return
  }
  downloadText(
    `global-quake-${stamp}.csv`,
    toCsv(items),
    'text/csv;charset=utf-8'
  )
}

function toGeoJson(items) {
  return {
    type: 'FeatureCollection',
    features: items.map(eq => ({
      type: 'Feature',
      id: eq.id,
      geometry: {
        type: 'Point',
        coordinates: [eq.lng, eq.lat, eq.depth ?? null],
      },
      properties: {
        magnitude: eq.mag ?? null,
        depthKm: eq.depth ?? null,
        place: eq.place || null,
        time: new Date(eq.time).toISOString(),
        source: eq.source || null,
        mmi: eq.mmi ?? null,
        felt: eq.felt ?? null,
        tsunami: eq.tsunami || 0,
        url: eq.url || null,
      },
    })),
  }
}

function toCsv(items) {
  const headers = ['id', 'time_utc', 'magnitude', 'depth_km', 'latitude', 'longitude', 'place', 'source', 'mmi', 'felt', 'tsunami', 'url']
  const rows = items.map(eq => [
    eq.id,
    new Date(eq.time).toISOString(),
    eq.mag ?? '',
    eq.depth ?? '',
    eq.lat ?? '',
    eq.lng ?? '',
    eq.place || '',
    eq.source || '',
    eq.mmi ?? '',
    eq.felt ?? '',
    eq.tsunami || 0,
    eq.url || '',
  ])
  return [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n')
}

function csvEscape(value) {
  const text = String(value ?? '')
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function loadShakeMap(eq) {
  shakeMap.value = {
    open: true,
    loading: true,
    place: eq.place || 'Selected event',
    imageUrl: '',
    productUrl: eq.url || '',
    error: '',
  }

  if (!eq.detail) {
    shakeMap.value = {
      ...shakeMap.value,
      loading: false,
      error: 'ShakeMap is only available for some USGS events.',
    }
    return
  }

  try {
    const response = await fetch(eq.detail)
    if (!response.ok) throw new Error(`USGS detail ${response.status}`)
    const detail = await response.json()
    const product = detail.properties?.products?.shakemap?.[0]
    const contents = product?.contents || {}
    const entries = Object.entries(contents)
    const imageEntry = entries.find(([key]) => /download\/intensity\.(jpg|png)$/i.test(key))
      || entries.find(([key]) => /intensity\.(jpg|png)$/i.test(key))
      || entries.find(([key]) => /download\/stationlist\.(jpg|png)$/i.test(key))

    if (!product || !imageEntry) {
      shakeMap.value = {
        ...shakeMap.value,
        loading: false,
        productUrl: product?.eventsource && product?.eventsourcecode
          ? `https://earthquake.usgs.gov/product/shakemap/${product.eventsource}${product.eventsourcecode}/atlas`
          : (eq.url || ''),
        error: 'No ShakeMap intensity image was published for this event.',
      }
      return
    }

    shakeMap.value = {
      ...shakeMap.value,
      loading: false,
      imageUrl: imageEntry[1].url,
      productUrl: product.properties?.eventsource && product.properties?.eventsourcecode
        ? `https://earthquake.usgs.gov/product/shakemap/${product.properties.eventsource}${product.properties.eventsourcecode}/atlas`
        : (eq.url || imageEntry[1].url),
      error: '',
    }
  } catch (err) {
    shakeMap.value = {
      ...shakeMap.value,
      loading: false,
      error: 'Unable to load ShakeMap right now.',
    }
  }
}

function closeShakeMap() {
  shakeMap.value.open = false
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

function focusEvent(eq, options = {}) {
  if (!map || eq.lat == null || eq.lng == null) return
  selectedEvent.value = eq
  if (isMobile.value) mobileSidebarOpen.value = false
  const mag = Number.isFinite(eq.mag) ? eq.mag : 3
  const openPopup = () => L.popup({ maxWidth: 300 }).setLatLng([eq.lat, eq.lng]).setContent(popupContentFor(eq)).openOn(map)
  if (options.popup !== false) map.once('moveend', () => nextTick().then(openPopup))
  const zoom = options.zoom ?? Math.max(6, 8 - mag * 0.4)
  const duration = options.duration ?? 1
  map.flyTo([eq.lat, eq.lng], zoom, { duration })
  if (options.popup !== false) setTimeout(openPopup, Math.round(duration * 1000) + 300)
}

function renderEpicenterEffect(eq) {
  if (!effectLayer || eq?.lat == null || eq?.lng == null) return
  clearEpicenterEffect()
  const icon = L.divIcon({
    className: 'quake-wave-icon',
    html: `
      <span class="quake-wave-ring ring-one"></span>
      <span class="quake-wave-ring ring-two"></span>
      <span class="quake-wave-ring ring-three"></span>
      <span class="quake-wave-core"></span>
    `,
    iconSize: [260, 260],
    iconAnchor: [130, 130],
  })
  epicenterEffectMarker = L.marker([eq.lat, eq.lng], {
    icon,
    interactive: false,
    keyboard: false,
    zIndexOffset: 1200,
  }).addTo(effectLayer)
  renderSeismicWavefronts(eq)
  seismicWaveTimer = setInterval(() => renderSeismicWavefronts(eq), 1000)
}

function clearEpicenterEffect() {
  if (epicenterEffectMarker && effectLayer) {
    effectLayer.removeLayer(epicenterEffectMarker)
  }
  epicenterEffectMarker = null
  clearSeismicWavefronts()
}

function renderSeismicWavefronts(eq) {
  if (!effectLayer || eq?.lat == null || eq?.lng == null || !Number.isFinite(eq.time)) return
  const elapsedSeconds = Math.max(0, (Date.now() - eq.time) / 1000)
  const pRadius = Math.min(3_200_000, elapsedSeconds * P_WAVE_KM_PER_SEC * 1000)
  const sRadius = Math.min(2_200_000, elapsedSeconds * S_WAVE_KM_PER_SEC * 1000)
  const latLng = [eq.lat, eq.lng]

  if (!pWaveCircle) {
    pWaveCircle = L.circle(latLng, {
      radius: pRadius,
      color: '#6edcff',
      weight: 2,
      opacity: 0.82,
      fill: false,
      interactive: false,
      dashArray: '8 7',
      className: 'seismic-wave seismic-wave-p',
    }).addTo(effectLayer)
  } else {
    pWaveCircle.setLatLng(latLng)
    pWaveCircle.setRadius(pRadius)
  }

  if (!sWaveCircle) {
    sWaveCircle = L.circle(latLng, {
      radius: sRadius,
      color: '#ff9b22',
      weight: 3,
      opacity: 0.9,
      fill: false,
      interactive: false,
      className: 'seismic-wave seismic-wave-s',
    }).addTo(effectLayer)
  } else {
    sWaveCircle.setLatLng(latLng)
    sWaveCircle.setRadius(sRadius)
  }
}

function clearSeismicWavefronts() {
  if (seismicWaveTimer) {
    clearInterval(seismicWaveTimer)
    seismicWaveTimer = null
  }
  if (pWaveCircle && effectLayer) effectLayer.removeLayer(pWaveCircle)
  if (sWaveCircle && effectLayer) effectLayer.removeLayer(sWaveCircle)
  pWaveCircle = null
  sWaveCircle = null
}

function convertJmaScale(scale) {
  return jmaScaleToIntensity(scale).mmi
}

function jmaIntensityLabel(scale) {
  return jmaScaleToIntensity(scale).label
}

/**
 * Handle a P2PQuake code-556 early-warning bulletin.
 *
 * Structure (verified against the live history API):
 *   { cancelled, earthquake: { hypocenter, originTime, arrivalTime },
 *     areas: [{ name, pref, scaleFrom, scaleTo, arrivalTime, kindCode }] }
 *
 * 551 only reports one whole-country maxScale; 556 is the one that carries a
 * per-prefecture intensity + wave-arrival table. This is live information,
 * not a certified EEW service.
 */
function handleEewBulletin(msg) {
  const eq = msg.earthquake || {}
  const hypocenter = eq.hypocenter || {}
  const areas = (msg.areas || []).map(area => {
    const maxScale = Math.max(Number(area.scaleFrom) || 0, Number(area.scaleTo) || 0)
    return {
      name: area.name || area.pref || 'Unknown area',
      pref: area.pref || null,
      scaleFrom: area.scaleFrom,
      scaleTo: area.scaleTo,
      mmi: convertJmaScale(maxScale),
      intensityLabel: jmaIntensityLabel(maxScale),
      arrivalTime: area.arrivalTime || null,
    }
  })
    .filter(area => Number.isFinite(area.mmi) && area.mmi > 1)
    .sort((a, b) => b.mmi - a.mmi)

  const maxMmi = areas[0]?.mmi ?? 0
  const now = Date.now()

  eew.value = {
    id: `eew-${msg.id || eq.originTime || now}`,
    lat: hypocenter.latitude,
    lng: hypocenter.longitude,
    depth: hypocenter.depth,
    place: hypocenter.name || hypocenter.reduceName || 'Japan',
    originTime: eq.originTime || msg.time || null,
    arrivalTime: eq.arrivalTime || null,
    cancelled: msg.cancelled === true,
    issuedAt: now,
    maxMmi,
    areas,
  }
  eewHistory.value = [eew.value, ...eewHistory.value].slice(0, 12)

  sourceHealth.value.jma = 'live'
  lastUpdate.value = new Date().toLocaleTimeString()

  // Only push an audible/visual alert for shake worth seeing.
  if (!msg.cancelled && maxMmi >= 3) {
    const pseudo = {
      id: eew.value.id,
      mag: maxMmi >= 6 ? 5.5 : 4.5,
      time: now,
      place: eew.value.place,
      source: 'JMA EEW',
      mmi: maxMmi,
    }
    playFreshEventAudio([pseudo])
    sendFreshEventNotification([pseudo])
  }
}

function sourceCount(sourceLabel) {
  return String(sourceLabel || '').split(' + ').filter(Boolean).length
}

function sourceHealthText(key) {
  const label = (sourceOptions.find(item => item.key === key) || {}).label || key
  const state = sourceHealth.value[key]
  if (state === 'error') return `${label}: last request failed`
  if (state === 'stale') return `${label}: no data for over 3 minutes`
  if (state === 'empty') return `${label}: no events in this window`
  if (state === 'ok') return `${label}: delivering events`
  if (key === 'jma') return 'JMA live: waiting for WebSocket events'
  return `${label}: not checked yet`
}

/**
 * Great-circle distance in km. Used to turn a P/S wave speed into an arrival
 * time for the user's own location.
 */
function greatCircleKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return NaN
  const R = 6371
  const toRad = deg => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

async function toggleLocate() {
  if (locateEnabled.value) {
    locateEnabled.value = false
    userLocation.value = null
    waveStatus.value = null
    return
  }
  if (!('geolocation' in navigator)) {
    waveStatus.value = { status: 'unavailable', note: 'Geolocation is not available in this browser.' }
    return
  }
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: LOCATE_TIMEOUT_MS,
        maximumAge: 300_000,
      })
    })
    userLocation.value = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
    locateEnabled.value = true
  } catch (err) {
    locateEnabled.value = false
    userLocation.value = null
    waveStatus.value = {
      status: 'unavailable',
      note: `Location permission was denied or timed out (${err?.message || err.code || 'unknown'}).`,
    }
  }
}

/**
 * P/S wave arrival status for a given event.
 *
 * Wave speeds are uniform approximations (P 6 km/s, S 3.5 km/s) that ignore
 * crustal structure, so this is presented as an estimate. kanameishi
 * interpolates JMA/JB travel-time tables by depth instead; shipping those
 * tables isn't justified for a global map.
 */
function computeWaveStatus(eq) {
  if (!eq || !userLocation.value) return null
  if (!Number.isFinite(eq.time) || eq.time > Date.now() + 60_000) return null
  const distanceKm = greatCircleKm(userLocation.value.lat, userLocation.value.lng, eq.lat, eq.lng)
  if (!Number.isFinite(distanceKm)) return null

  const elapsedSec = Math.max(0, (Date.now() - eq.time) / 1000)
  const pSec = distanceKm / P_WAVE_KM_PER_SEC
  const sSec = distanceKm / S_WAVE_KM_PER_SEC
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

function isAlertableNewEvent(eq, now = Date.now()) {
  if (!Number.isFinite(eq?.time)) return false
  return eq.time <= now + 2 * 60 * 1000 && now - eq.time <= ALERT_EVENT_MAX_AGE_MS
}

function pushNewAlerts(items) {
  const freshAlerts = items.filter(eq => isAlertableNewEvent(eq)).sort((a, b) => b.time - a.time)
  if (!freshAlerts.length) return

  newAlerts.value = [...freshAlerts, ...newAlerts.value].slice(0, 5)
  playFreshEventAudio(freshAlerts)
  sendFreshEventNotification(freshAlerts)
  triggerLiveFocus(freshAlerts)
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

function triggerLiveFocus(items) {
  if (!liveFocusEnabled.value || replayEnabled.value) return
  const event = [...items]
    .filter(eq => eq.mag >= 5 && eq.lat != null && eq.lng != null)
    .sort((a, b) => (b.mag ?? -1) - (a.mag ?? -1))[0]
  if (!event) return

  liveFocusEvent.value = event
  selectedEvent.value = event
  if (isMobile.value) mobileSidebarOpen.value = false
  if (liveFocusTimer) clearTimeout(liveFocusTimer)

  const mag = Number.isFinite(event.mag) ? event.mag : 5
  const zoom = Math.max(5.8, Math.min(7.4, 8.15 - mag * 0.18))
  focusEvent(event, { zoom, duration: 1.35, popup: false })
  renderEpicenterEffect(event)
  speakFreshEventAlert(event)
  nextTick().then(renderMarkers)

  liveFocusTimer = setTimeout(() => {
    liveFocusEvent.value = null
    clearEpicenterEffect()
    liveFocusTimer = null
  }, 45_000)
}

function clearLiveFocus() {
  liveFocusEvent.value = null
  clearEpicenterEffect()
  if (liveFocusTimer) {
    clearTimeout(liveFocusTimer)
    liveFocusTimer = null
  }
}

async function loadData() {
  const now = Date.now()
  if (now - lastFetchTime < CATALOG_POLL_MS) return
  const requestId = ++loadRequestId
  const feed = currentFeed.value
  const sourceKeys = [...selectedSources.value]

  try {
    connected.value = true
    loadingData.value = true
    lastFetchTime = now

    const catalogEvents = await fetchCatalogEvents(feed, sourceKeys)
    if (requestId !== loadRequestId) return

    const seen = new Set()
    const merged = []
    const fresh = []

    for (const eq of catalogEvents) {
      if (!eq?.id || seen.has(eq.id)) continue
      seen.add(eq.id)
      if (!knownIds.has(eq.id)) {
        rememberId(eq.id, knownIds)
        fresh.push(eq)
      }
      merged.push(eq)
    }

    for (const eq of events.value) {
      if (eq.source === 'JMA' && sourceKeys.includes('jma') && !seen.has(eq.id)) merged.push(eq)
    }

    events.value = merged
    lastUpdate.value = new Date().toLocaleTimeString()

    if (fresh.length > 0 && initialLoadDone && !suppressNextFreshAlerts) pushNewAlerts(fresh)
    suppressNextFreshAlerts = false
    initialLoadDone = true

    await nextTick()
    renderMarkers()
  } catch (err) {
    if (requestId !== loadRequestId) return
    console.error('Failed to fetch earthquake data:', err)
    connected.value = false
  } finally {
    if (requestId === loadRequestId) loadingData.value = false
  }
}

async function fetchCatalogEvents(feed, sourceKeys = selectedSources.value) {
  const sourceSet = new Set(sourceKeys)
  const windowHours = hoursForFeed(feed)
  const cacheKey = `${feed}|${sourceKeys.filter(source => source !== 'jma').sort().join(',')}`
  const cached = feedCache.get(cacheKey)
  if (cached && Date.now() - cached.time < FEED_CACHE_MS) return cached.events

  // Track each source individually so a source that fails (or returns an
  // empty table) is visible in the UI instead of silently reporting zero
  // events while still being listed as active.
  const health = { usgs: 'idle', emsc: 'idle', gfz: 'idle', geonet: 'idle' }
  const tasks = []
  const addTask = (key, promise) => {
    tasks.push(promise
      .then(items => {
        health[key] = items.length > 0 ? 'ok' : 'empty'
        return items
      })
      .catch(err => {
        health[key] = 'error'
        console.warn(`${key.toUpperCase()} source failed:`, err)
        return []
      }))
  }

  // Keep the last raw USGS FeatureCollection so a 304 Not Modified can reuse
  // it instead of re-downloading (all_week is ~1.5 MB).
  const usgsFeedKey = feed
  const knownUsgs = rawUsgsCache.get(usgsFeedKey)

  if (sourceSet.has('usgs')) {
    addTask('usgs', fetchUSGS(feed, { cached: knownUsgs })
      .then(data => {
        rawUsgsCache.set(usgsFeedKey, data)
        return (data.features || []).map(feature => normalizeEvent(feature, 'usgs'))
      }))
  }
  if (sourceSet.has('emsc')) {
    const start = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
    addTask('emsc', fetchEMSC({ start, minmag: fdsnMinMag(feed), limit: sourceLimit(feed) })
      .then(features => (features || []).map(feature => normalizeEvent(feature, 'emsc'))))
  }
  if (sourceSet.has('gfz')) {
    const start = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
    addTask('gfz', fetchGFZ({ start, minmag: fdsnMinMag(feed), limit: sourceLimit(feed) })
      .then(features => (features || []).map(feature => normalizeEvent(feature, 'gfz'))))
  }
  if (sourceSet.has('geonet')) {
    const start = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
    addTask('geonet', fetchGeoNet({ start, limit: feed === 'all_week' ? 350 : 180 })
      .then(features => (features || []).map(feature => normalizeEvent(feature, 'geonet'))))
  }

  const merged = dedupeEvents((await Promise.all(tasks)).flat())
  feedCache.set(cacheKey, { time: Date.now(), events: merged })
  sourceHealth.value = { ...sourceHealth.value, ...health }
  const okNow = Date.now()
  const lastOk = { ...sourceLastOk.value }
  for (const key of Object.keys(health)) {
    if (health[key] === 'ok') lastOk[key] = okNow
  }
  sourceLastOk.value = lastOk
  markStaleSources()
  return merged
}

/**
 * Promote a source from 'ok' to 'stale' when it has not delivered data for
 * STALE_SOURCE_MS. This catches a source that silently stops answering
 * (DNS failure, rate limit, upstream outage) — a plain success/failure flag
 * would keep reporting 'ok' forever after the last successful poll.
 */
function markStaleSources() {
  const now = Date.now()
  let changed = false
  const next = { ...sourceHealth.value }
  for (const key of Object.keys(sourceLastOk.value)) {
    if (next[key] === 'ok' && sourceLastOk.value[key] && now - sourceLastOk.value[key] > STALE_SOURCE_MS) {
      next[key] = 'stale'
      changed = true
    }
  }
  if (changed) sourceHealth.value = next
}

function hoursForFeed(feed) {
  return (catalogWindows.find(item => item.key === feed) || catalogWindows[1]).hours
}

function fdsnMinMag(feed) {
  // Keep the secondary catalogs aligned with the USGS feed's magnitude floor,
  // otherwise a "M4.5+ past 7 days" window would still pull M2 events from
  // EMSC/GFZ and the merged list would contradict its own label.
  if (feed === '4.5_week') return 4.5
  if (feed === 'all_week') return 2.5
  return 2
}

function sourceLimit(feed) {
  if (feed === 'all_week') return 500
  if (feed === '4.5_week') return 300
  if (feed === 'all_day') return 250
  return 80
}

// Dedupe matching tolerances. Also used as the spatial-grid cell size below.
const DEDUPE_CELL_DEG = 0.45
const DEDUPE_TIME_MS = 3 * 60 * 1000
const DEDUPE_MAG = 0.5

/**
 * Shortest angular distance between two longitudes.
 *
 * A plain `a - b` reports 359.8° for 179.9 vs -179.9, so earthquakes straddling
 * the antimeridian (Fiji, Kermadec, Tonga — a very active region) were never
 * merged across catalogs and appeared as duplicates.
 */
function lngDelta(a, b) {
  let d = a - b
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return d
}

/**
 * Merge the same physical earthquake reported by several catalogs.
 *
 * The naive version compared every incoming event against every already-kept
 * one: ~4 million comparisons for a 7-day load (~2,800 raw events), measured at
 * 34 ms and repeated on every 60 s poll. Since the match radius is bounded in
 * space, a grid keyed by the same cell size cuts that to a few neighbours.
 */
function dedupeEvents(items) {
  const sorted = [...items].filter(Boolean).sort((a, b) => b.time - a.time)
  const deduped = []
  // "latCell:lngCell" -> events in that cell
  const grid = new Map()
  const lngCells = Math.round(360 / DEDUPE_CELL_DEG)

  // Normalise a longitude into cell index space [0, lngCells) so cells wrap
  // cleanly at the antimeridian.
  const lngCellOf = (lng) => {
    let idx = Math.floor(lng / DEDUPE_CELL_DEG)
    idx %= lngCells
    if (idx < 0) idx += lngCells
    return idx
  }
  const latCellOf = (lat) => Math.floor(lat / DEDUPE_CELL_DEG)

  for (const event of sorted) {
    let match = null

    if (event.lat != null && event.lng != null) {
      const latIdx = latCellOf(event.lat)
      const lngIdx = lngCellOf(event.lng)
      // Candidates must be in the same cell or one of the 8 neighbours: two
      // points less than one cell apart can straddle a cell boundary but never
      // be two cells apart.
      const candidates = []
      for (let dLat = -1; dLat <= 1; dLat++) {
        for (let dLng = -1; dLng <= 1; dLng++) {
          let nj = (lngIdx + dLng) % lngCells
          if (nj < 0) nj += lngCells
          const bucket = grid.get(`${latIdx + dLat}:${nj}`)
          if (bucket) candidates.push(...bucket)
        }
      }
      // Same semantics as the original scan: newest matching report wins.
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

function isSameEarthquake(a, b) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return false
  const closeInTime = Math.abs(a.time - b.time) < DEDUPE_TIME_MS
  const closeInSpace = Math.abs(a.lat - b.lat) < DEDUPE_CELL_DEG
    && Math.abs(lngDelta(a.lng, b.lng)) < DEDUPE_CELL_DEG
  const closeInMag = a.mag == null || b.mag == null || Math.abs(a.mag - b.mag) < DEDUPE_MAG
  return closeInTime && closeInSpace && closeInMag
}

function mergeSourceLabel(a, b) {
  return [...new Set(String(a).split(' + ').concat(String(b).split(' + ')).filter(Boolean))].join(' + ')
}

function connectP2PQuake() {
  if (p2pSocket) return
  if (p2pReconnectTimer) {
    clearTimeout(p2pReconnectTimer)
    p2pReconnectTimer = null
  }
  try {
    p2pSocket = new WebSocket(P2PQUAKE_WS)
    p2pSocket.onopen = () => { p2pConnected.value = true }
    p2pSocket.onmessage = (message) => {
      try {
        const msg = JSON.parse(message.data)
        if (!selectedSources.value.includes('jma')) return
        if (msg.code === P2P_QUAKE_MSG.EARLY_WARNING) {
          handleEewBulletin(msg)
          return
        }
        if (msg.code !== P2P_QUAKE_MSG.EARTHQUAKE || !msg.earthquake) return
        const eq = msg.earthquake
        const hypocenter = eq.hypocenter || {}
        const id = `p2p-${msg.id || eq.id || eq.time || Date.now()}`
        if (knownIds.has(id)) return
        rememberId(id, knownIds)
        const scale = eq.maxScale ?? null
        const event = {
          id,
          lat: hypocenter.latitude,
          lng: hypocenter.longitude,
          depth: hypocenter.depth,
          mag: hypocenter.magnitude ?? eq.magnitude,
          place: hypocenter.name || 'Japan region',
          time: eq.time ? new Date(eq.time).getTime() : Date.now(),
          source: 'JMA',
          mmi: convertJmaScale(scale),
          // JMA intensity grade (弱/やや強い/…) — 551 carries only one
          // scalar, so this is the whole-country max, not a map.
          intensityLabel: jmaIntensityLabel(scale),
          // JMA tsunami flags are literal strings: 'None', 'Unknown', 'Issued',
          // 'Advisory', 'Warning'.
          tsunami: (eq.domesticTsunami && eq.domesticTsunami !== 'None' && eq.domesticTsunami !== 'Unknown')
            ? eq.domesticTsunami : 0,
          foreignTsunami: eq.foreignTsunami || null,
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
      if (!p2pReconnectTimer) {
        p2pReconnectTimer = setTimeout(() => {
          p2pReconnectTimer = null
          connectP2PQuake()
        }, 10_000)
      }
    }
    p2pSocket.onerror = () => p2pSocket?.close()
  } catch {
    p2pConnected.value = false
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

function isLocalPreviewHost() {
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

/**
 * Pause catalog polling while the tab is hidden.
 *
 * The setInterval kept firing in background tabs — a tab left open overnight
 * re-downloaded the catalog every minute for nothing, and for all_week that is
 * ~1.5 MB a time (before the conditional-request change).
 */
function handleVisibilityChange() {
  if (document.hidden) {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  } else {
    // Catch up immediately on return, then resume the normal cadence.
    if (!pollTimer) pollTimer = setInterval(loadData, CATALOG_POLL_MS)
    lastFetchTime = 0
    loadData()
  }
}

function triggerDemoMajorAlert() {
  const event = {
    id: `demo-major-${Date.now()}`,
    lat: 38.32,
    lng: 142.37,
    depth: 24,
    mag: 6.6,
    place: 'off the east coast of Honshu, Japan',
    time: Date.now(),
    source: 'Demo',
    mmi: 5,
    tsunami: 0,
  }
  rememberId(event.id, knownIds)
  events.value = [event, ...events.value.filter(eq => eq.id !== event.id)]
  lastUpdate.value = new Date().toLocaleTimeString()
  pushNewAlerts([event])
  nextTick().then(renderMarkers)
}

onMounted(() => {
  loadSettings()
  checkMobile()
  initMap()
  loadData()
  connectP2PQuake()
  if (showStrongMotionLayer.value) startStrongMotionMonitor()
  pollTimer = setInterval(loadData, CATALOG_POLL_MS)
  window.addEventListener('resize', checkMobile)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  if (isLocalPreviewHost()) {
    window.__GLOBAL_QUAKE_TEST__ = {
      triggerMajorAlert: triggerDemoMajorAlert,
    }
    if (new URLSearchParams(window.location.search).has('demoAlert')) {
      setTimeout(triggerDemoMajorAlert, 1200)
    }
  }
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (resizeObserver) resizeObserver.disconnect()
  if (p2pReconnectTimer) clearTimeout(p2pReconnectTimer)
  if (p2pSocket) {
    p2pSocket.onclose = null
    p2pSocket.close()
  }
  stopStrongMotionMonitor()
  if (audioContext) audioContext.close()
  if (liveFocusTimer) clearTimeout(liveFocusTimer)
  clearEpicenterEffect()
  alertTimers.forEach(clearTimeout)
  window.removeEventListener('resize', checkMobile)
  if (isLocalPreviewHost()) delete window.__GLOBAL_QUAKE_TEST__
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
.stat-badge.stat-jma { color: #9aa4b6; }
.stat-badge.stat-jma.live { color: #8fe7ff; background: rgba(55,212,216,0.1); }
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
.alert-tag {
  margin: 0 4px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(55,212,216,0.12);
  color: #8fe7ff;
  font-size: 10px;
  font-weight: 700;
}
@keyframes alertSlideIn {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}
.strong-motion-panel {
  position: absolute;
  top: 58px;
  right: 12px;
  z-index: 1001;
  width: 300px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(11,14,24,0.94);
  box-shadow: 0 16px 42px rgba(0,0,0,0.44);
  backdrop-filter: blur(14px);
  overflow: hidden;
}
.strong-motion-head {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.strong-motion-title {
  color: #eef3ff;
  font-size: 12px;
  font-weight: 820;
}
.strong-motion-time {
  margin-top: 2px;
  color: #8fe7ff;
  font-size: 10px;
  font-weight: 700;
}
.strong-motion-close {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: rgba(255,255,255,0.08);
  color: #cbd3e3;
  cursor: pointer;
}
.strong-motion-frame {
  min-height: 182px;
  display: grid;
  place-items: center;
  background: #05070d;
}
.strong-motion-frame img {
  display: block;
  width: 100%;
  height: auto;
}
.strong-motion-state {
  padding: 24px;
  color: #8f98aa;
  font-size: 12px;
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
.export-field,
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
/* Source health: a source that is broken but still listed used to be
   indistinguishable from one that simply had no events in the window. */
.source-toggle.source-error {
  color: #ff9d9d;
  border-color: rgba(255,90,90,0.45);
  background: rgba(255,60,60,0.12);
  text-decoration: line-through;
  text-decoration-color: rgba(255,120,120,0.7);
}
.source-toggle.source-empty {
  color: #ffcf87;
  border-color: rgba(255,180,60,0.35);
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
.layer-status {
  margin-left: auto;
  color: #8f98aa;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

/* --- Japan EEW panel (P2PQuake code 556) --- */
.eew-panel {
  position: absolute;
  top: 46px;
  right: 10px;
  z-index: 1002;
  width: min(320px, calc(100vw - 20px));
  max-height: min(46vh, 340px);
  overflow-y: auto;
  border-radius: 10px;
  border: 1px solid rgba(255,140,40,0.45);
  background: rgba(28,18,10,0.96);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  padding: 10px 12px 11px;
  animation: alertSlideIn 0.3s ease;
}
.eew-panel.shifted { left: 320px; right: 10px; }
.eew-panel.cancelled {
  border-color: rgba(150,150,160,0.35);
  background: rgba(24,24,30,0.94);
}
.eew-head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
}
.eew-pulse {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ff8a2b;
  flex: 0 0 auto;
  animation: eewPulse 1.1s ease-out infinite;
}
.eew-panel.cancelled .eew-pulse {
  background: #7a7a86;
  animation: none;
}
.eew-title {
  color: #ffd9b0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  flex: 1 1 auto;
}
.eew-cancelled {
  color: #a9a9b4;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.09);
}
.eew-close {
  margin-left: auto;
}
.eew-main {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.eew-intensity {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 0 0 auto;
}
.eew-intensity-label {
  color: #a88;
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.eew-intensity-value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 74px;
  padding: 3px 9px;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  background: #444;
}
.eew-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #b9a99a;
  font-size: 11px;
  min-width: 0;
}
.eew-areas {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  border-top: 1px solid rgba(255,255,255,0.08);
  padding-top: 7px;
}
.eew-area {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
}
.eew-area-name {
  color: #d5cfc6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.eew-area-scale {
  flex: 0 0 auto;
  font-weight: 700;
  font-size: 10.5px;
}
.eew-notice {
  margin: 0;
  color: #8b857d;
  font-size: 9.5px;
  line-height: 1.45;
  border-top: 1px solid rgba(255,255,255,0.07);
  padding-top: 6px;
}
@keyframes eewPulse {
  0% { box-shadow: 0 0 0 0 rgba(255,138,43,0.55); }
  70% { box-shadow: 0 0 0 9px rgba(255,138,43,0); }
  100% { box-shadow: 0 0 0 0 rgba(255,138,43,0); }
}

/* --- P/S wave arrival panel ---
   Turns the app's existing uniform wave speeds (P 6 km/s, S 3.5 km/s) into
   a per-user arrival estimate, gated on explicit location consent. */
.wave-panel {
  position: absolute;
  top: 84px;
  left: 10px;
  z-index: 1001;
  width: min(264px, calc(100vw - 20px));
  border-radius: 10px;
  border: 1px solid rgba(110,220,255,0.35);
  background: rgba(14,22,30,0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  padding: 10px 12px 11px;
  animation: alertSlideIn 0.3s ease;
}
.wave-panel.shifted { left: 330px; }
.wave-panel.unavailable {
  border-color: rgba(255,140,90,0.35);
  background: rgba(28,20,14,0.94);
}
.wave-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.wave-title {
  color: #9ce2ff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.wave-distance {
  color: #8fa3b5;
  font-size: 10.5px;
  font-weight: 650;
  flex: 0 0 auto;
}
.wave-note {
  color: #d7e4ee;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 9px;
}
.wave-bars {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 8px;
}
.wave-bar {
  display: grid;
  grid-template-columns: 46px 1fr;
  align-items: center;
  gap: 8px;
}
.wave-bar-label {
  color: #8fa3b5;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.wave-track {
  display: block;
  height: 7px;
  border-radius: 4px;
  background: rgba(255,255,255,0.09);
  overflow: hidden;
}
.wave-fill {
  display: block;
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s linear;
}
.wave-p {
  background: linear-gradient(90deg, #4aa8d8, #6edcff);
  box-shadow: 0 0 8px rgba(110,220,255,0.5);
}
.wave-s {
  background: linear-gradient(90deg, #d8662e, #ff8a2b);
  box-shadow: 0 0 8px rgba(255,138,43,0.5);
}
.layer-toggle.active .layer-status {
  color: #8fe7ff;
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
.option-stack {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}
.export-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.replay-box {
  display: grid;
  gap: 7px;
  padding: 7px;
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.035);
}
.replay-box.active {
  border-color: rgba(77,166,255,0.24);
  background: rgba(77,166,255,0.07);
}
.replay-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  gap: 6px;
}
.replay-main {
  min-width: 0;
}
.replay-play {
  min-height: 32px;
}
.replay-slider {
  width: 100%;
  accent-color: #4da6ff;
}
.replay-slider:disabled {
  opacity: 0.45;
}
.replay-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  color: #8f98aa;
  font-size: 10px;
}
.mini-link {
  border: 0;
  background: transparent;
  color: #77bdff;
  font-size: 10px;
  cursor: pointer;
}
.mini-link:disabled {
  color: #596172;
  cursor: default;
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
.load-more {
  width: 100%;
  margin: 6px 0 4px;
  min-height: 34px;
  border-radius: 7px;
  border: 1px solid rgba(77,166,255,0.28);
  background: rgba(77,166,255,0.1);
  color: #8fc4ff;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.load-more:hover {
  background: rgba(77,166,255,0.17);
  border-color: rgba(77,166,255,0.45);
}
.load-more-remaining {
  color: #7c8a9e;
  font-weight: 500;
}
.load-more.subtle {
  border-color: rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: #9fa8ba;
  font-weight: 500;
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
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
}
/* Cross-verification badge: dedupeEvents already merges a single physical
   earthquake reported by several independent catalogs into one event with a
   source label like "USGS + EMSC". Surfacing that count is the signal that
   matters most for trusting a report. */
.event-source {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.event-source.multi {
  color: #7fd6a0;
  font-weight: 650;
}
.confirm-badge {
  display: inline-flex;
  align-items: center;
  min-width: 16px;
  height: 15px;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(80,220,140,0.18);
  color: #7fe0a4;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.confirm-badge.inline {
  margin-left: 4px;
  height: 16px;
  font-size: 10px;
  vertical-align: 1px;
}
.event-flag {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(120,180,255,0.16);
  color: #9cc8ff;
  font-size: 9.5px;
  font-weight: 700;
  white-space: nowrap;
}
.event-flag.danger {
  background: rgba(255,90,90,0.18);
  color: #ff9d9d;
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
.shakemap-panel {
  position: absolute;
  right: 18px;
  bottom: 198px;
  z-index: 1000;
  width: min(360px, calc(100vw - 76px));
  max-height: 42vh;
  overflow: auto;
  padding: 14px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(15,18,31,0.96);
  backdrop-filter: blur(14px);
}
.shakemap-title {
  padding-right: 28px;
  color: #eef3ff;
  font-size: 14px;
  font-weight: 800;
}
.shakemap-subtitle {
  margin: 3px 28px 10px 0;
  color: #8f98aa;
  font-size: 11px;
  line-height: 1.35;
}
.shakemap-state {
  padding: 18px 4px;
  color: #9da8bd;
  font-size: 12px;
}
.shakemap-image {
  display: block;
  width: 100%;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.08);
}
.shakemap-links {
  margin-top: 8px;
  font-size: 12px;
}
.shakemap-links a {
  color: #77bdff;
}
.broadcast-panel {
  position: absolute;
  left: 58px;
  right: 18px;
  bottom: 26px;
  z-index: 1002;
  min-height: 118px;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 10px;
  padding: 14px 50px 14px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 136, 0, 0.5);
  background:
    linear-gradient(90deg, rgba(72, 24, 5, 0.98), rgba(23, 26, 42, 0.97) 42%, rgba(15, 18, 31, 0.94)),
    rgba(15,18,31,0.96);
  box-shadow: 0 18px 46px rgba(0,0,0,0.52), inset 5px 0 0 rgba(255,136,0,0.94);
  backdrop-filter: blur(16px);
  animation: broadcastIn 0.28s ease;
}
.broadcast-panel.shifted {
  left: 340px;
}
.broadcast-kicker {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  width: fit-content;
  padding: 3px 8px;
  border-radius: 5px;
  background: rgba(255,136,0,0.2);
  color: #ffe0b0;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0;
  text-transform: uppercase;
}
.broadcast-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff9b22;
  box-shadow: 0 0 12px rgba(255,136,0,0.85);
  animation: livePulse 1s ease-in-out infinite;
}
.broadcast-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.broadcast-mag-stack,
.broadcast-intensity {
  flex: 0 0 auto;
  min-width: 92px;
  display: grid;
  gap: 4px;
  align-content: center;
  justify-items: center;
  padding: 9px 10px;
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.08);
}
.broadcast-mag-label {
  color: #aeb8ca;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}
.broadcast-mag {
  font-size: 42px;
  line-height: 0.95;
  font-weight: 900;
  text-shadow: 0 2px 16px rgba(0,0,0,0.5);
}
.broadcast-intensity {
  min-width: 78px;
}
.broadcast-intensity-value {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  color: #111827;
  font-size: 30px;
  font-weight: 900;
  box-shadow: inset 0 -3px 0 rgba(0,0,0,0.16);
}
.broadcast-info {
  min-width: 0;
}
.broadcast-place {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #fff;
  font-size: 19px;
  font-weight: 820;
}
.broadcast-message {
  margin-top: 5px;
  color: #ffe0b0;
  font-size: 13px;
  line-height: 1.35;
}
.broadcast-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 5px;
  color: #c7cfdf;
  font-size: 12px;
}
.broadcast-meta span {
  padding: 2px 7px;
  border-radius: 5px;
  background: rgba(255,255,255,0.08);
}
.broadcast-close {
  position: absolute;
  top: 9px;
  right: 10px;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: rgba(255,255,255,0.08);
  color: #e7edf8;
  cursor: pointer;
}
@keyframes broadcastIn {
  from { transform: translateY(18px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes livePulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.45); opacity: 0.68; }
}
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
.detail-action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 8px;
}
.detail-action {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid rgba(77,166,255,0.25);
  background: rgba(77,166,255,0.1);
  color: #9fd0ff;
  font-size: 12px;
  text-decoration: none;
  cursor: pointer;
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
.seismic-wave {
  filter: drop-shadow(0 0 8px currentColor);
}
.quake-wave-icon {
  pointer-events: none;
}
.quake-wave-ring,
.quake-wave-core {
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.quake-wave-ring {
  width: 36px;
  height: 36px;
  border: 4px solid rgba(255, 136, 0, 0.88);
  box-shadow: 0 0 20px rgba(255, 136, 0, 0.48);
  animation: quakeWave 3.2s ease-out infinite;
}
.quake-wave-ring.ring-two {
  animation-delay: 0.72s;
  border-color: rgba(255, 194, 61, 0.72);
}
.quake-wave-ring.ring-three {
  animation-delay: 1.44s;
  border-color: rgba(255, 68, 68, 0.68);
}
.quake-wave-core {
  width: 22px;
  height: 22px;
  border: 3px solid #fff6d8;
  background: #ff3b2f;
  box-shadow: 0 0 18px rgba(255, 59, 47, 0.95), 0 0 34px rgba(255, 136, 0, 0.65);
  animation: epicenterPulse 0.82s ease-in-out infinite;
}
@keyframes markerGlow {
  0%, 100% { filter: drop-shadow(0 0 4px #ffcc00); }
  50% { filter: drop-shadow(0 0 12px #ff6600); }
}
@keyframes quakeWave {
  0% {
    opacity: 0.95;
    transform: translate(-50%, -50%) scale(0.18);
  }
  72% {
    opacity: 0.42;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(6.8);
  }
}
@keyframes epicenterPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(0.92); }
  50% { transform: translate(-50%, -50%) scale(1.18); }
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
    left: min(92vw, 360px);
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
  .strong-motion-panel.mobile {
    top: 56px;
    right: 8px;
    width: min(46vw, 184px);
  }
  .strong-motion-head {
    min-height: 34px;
    padding: 6px 7px;
  }
  .strong-motion-title {
    font-size: 10px;
  }
  .strong-motion-time {
    font-size: 9px;
  }
  .strong-motion-close {
    width: 26px;
    height: 26px;
  }
  .strong-motion-frame {
    min-height: 108px;
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
  .broadcast-panel,
  .broadcast-panel.shifted {
    left: 8px;
    right: 8px;
    bottom: calc(max(10px, env(safe-area-inset-bottom)) + 6px);
    min-height: 116px;
    max-height: calc(100dvh - 24px);
    overflow: hidden;
    padding: 10px 42px 10px 10px;
  }
  .broadcast-main {
    gap: 9px;
  }
  .broadcast-mag-stack,
  .broadcast-intensity {
    min-width: 58px;
    padding: 7px 6px;
  }
  .broadcast-mag-label {
    font-size: 9px;
  }
  .broadcast-mag {
    font-size: 30px;
  }
  .broadcast-intensity {
    min-width: 52px;
  }
  .broadcast-intensity-value {
    min-width: 34px;
    min-height: 34px;
    font-size: 22px;
  }
  .broadcast-place {
    font-size: 15px;
  }
  .broadcast-message {
    font-size: 11px;
  }
  .broadcast-meta {
    gap: 5px;
    font-size: 10px;
  }
  .shakemap-panel {
    left: 10px;
    right: 10px;
    bottom: calc(46dvh + 20px);
    width: auto;
    max-height: 36dvh;
  }
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
