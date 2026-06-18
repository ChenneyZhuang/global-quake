# 🌍 Global Quake

**Real-time worldwide earthquake monitor. Zero API cost. No backend.**

A free, open-source earthquake dashboard powered by 5 public data sources, delivering near-real-time seismic events from across the globe. Built with Vue 3 + Leaflet, optimized for both desktop and mobile.

👉 **[Live Demo](https://quakenow.duckdns.org:8445/)**

<p align="center">
  <img src="https://img.shields.io/badge/framework-Vue%203-42b883?logo=vue.js" alt="Vue 3">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT">
  <img src="https://img.shields.io/badge/data%20sources-5-blue" alt="5 data sources">
  <img src="https://img.shields.io/badge/API%20keys-none-brightgreen" alt="No API keys">
  <img src="https://img.shields.io/badge/cost-%240-free" alt="Zero cost">
</p>

---

## ✨ Features

### Data
- **5 free data sources** — USGS · EMSC · GFZ/GEOFON · GeoNet (NZ) · JMA via P2PQuake WebSocket
- **Toggle sources on/off** — mix and match any combination of providers
- **Near-real-time** — USGS/EMSC/GFZ/GeoNet via 60s polling, Japan events via WebSocket (< 5 seconds)
- **Catalog windows** — Past Hour / Past 24 Hours / Past 7 Days
- **All magnitudes** — from micro-quakes (~M1.0) to great earthquakes (M8+)

### Map
- **JQuake-inspired color scale** — magnitude-colored circles from green (M1-2) through yellow/orange/red to purple (M8+)
- **Depth-colored rings** (toggleable) — shallow (warm cyan) to deep (cool purple)
- **Zoom-scaled markers** — small dots at world view, detailed rings when zoomed in
- **World wrapping** — seamless horizontal panning with `worldCopyJump`
- **Canvas renderer** — smooth performance with hundreds of markers
- **Rich popups** — magnitude, location, depth, MMI intensity, tsunami alerts, source links
- **Max bounds with viscosity** — gentle resistance at map edges

### UI
- **Dark theme** — designed for 24/7 monitoring, low eye strain
- **Live indicator** — pulsing green dot when data is flowing
- **Stats bar** — total events, M5+ count, M7+ count, active sources, last update time
- **New event alerts** — gold notification bar with auto-dismiss when fresh earthquakes arrive
- **Magnitude filter** — M1-2 / M3-4 / M5-6 / M7+ quick filters
- **Sidebar** — scrollable event list with magnitude-colored badges and source tags
- **Detail panel** — full event info on click: coordinates, depth, MMI, felt reports, tsunami status
- **Collapsible legends** — magnitude color scale + depth color scale
- **Keyboard navigation** — arrow keys pan map, +/- zoom, Escape closes panels

### Mobile
- **Hamburger drawer sidebar** — overlay panel, doesn't block map
- **Responsive layout** — reflows for small screens (< 768px)
- **Pinch zoom** — Leaflet `touchZoom` with `bounceAtZoomLimits: false`
- **Safe areas** — respects iPhone notch / Dynamic Island
- **Large touch targets** — 36×36px buttons, scrollable lists
- **Detail panel** — bottom sheet on mobile, side panel on desktop

### Engineering
- **XSS-safe** — all user-visible text HTML-escaped
- **ARIA labels** — buttons have `aria-label`, toggles have `aria-pressed`
- **Feed caching** — 55-second cache per window to avoid redundant fetches
- **De-duplication** — `knownIds` Set prevents duplicate events across sources
- **Memory management** — max 650 visible events, old markers cleaned up
- **No state library** — pure Vue 3 Composition API (`ref`, `computed`)
- **Pure static SPA** — deploy anywhere: nginx, S3, GitHub Pages, Cloudflare Pages

---

## 📡 Data Sources

| Source | Coverage | Protocol | Latency | Rate Limit |
|--------|----------|----------|---------|------------|
| **USGS** | Global | GeoJSON feed (polling) | ~1-5 min | None (public) |
| **EMSC** | Global, best for Europe/Med | FDSN JSON (polling) | ~2-10 min | Fair-use |
| **GFZ/GEOFON** | Global catalog | FDSN GeoJSON (polling) | ~2-10 min | Fair-use |
| **GeoNet** | New Zealand region | REST API (polling) | ~1-5 min | Fair-use |
| **P2PQuake/JMA** | Japan region | WebSocket (streaming) | < 5 seconds | Anonymous |

All sources are **free, public, and require no API key**. All return earthquake data that is globally accessible with fair-use constraints.

---

## 🚀 Quick Start

```bash
git clone https://github.com/ChenneyZhuang/global-quake.git
cd global-quake
npm install
npm run dev        # Dev server at http://localhost:5173
npm run build      # Production build → dist/
```

Serve `dist/` with any static file server:

```bash
# Python
python3 -m http.server -d dist 8080

# Node.js
npx serve dist

# nginx
# point root to dist/ and add try_files $uri /index.html
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Global Quake                      │
│                   (Vue 3 SPA)                         │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  USGS Feed  │  │ EMSC FDSN    │  │ GFZ FDSN   │ │
│  │  (poll 60s) │  │ (poll 60s)   │  │ (poll 60s) │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬─────┘ │
│         │                │                  │        │
│  ┌──────┴──────┐  ┌──────┴───────┐         │        │
│  │  GeoNet API │  │ P2PQuake WS  │         │        │
│  │ (poll 60s)  │  │  (streaming) │         │        │
│  └──────┬──────┘  └──────┬───────┘         │        │
│         │                │                  │        │
│         └────────────────┼──────────────────┘        │
│                          ▼                           │
│                 ┌────────────────┐                   │
│                 │  normalizeEvent │                   │
│                 │  (unified model)│                   │
│                 └───────┬────────┘                   │
│                         ▼                            │
│              ┌────────────────────┐                  │
│              │  Events[] + knownIds │                 │
│              └────────┬───────────┘                  │
│                       ▼                              │
│         ┌─────────────────────────┐                  │
│         │  CanvasRenderer (Leaflet)│                  │
│         │  Markers + Popups       │                  │
│         └─────────────────────────┘                  │
│                       ▼                              │
│                 ┌───────────┐                        │
│                 │   User UI │                        │
│                 │  Dark Map │                        │
│                 └───────────┘                        │
└─────────────────────────────────────────────────────┘
```

**Data flow:**
1. Five independent fetchers poll/stream from public APIs
2. Each raw event passes through `normalizeEvent(feature, source)` → unified model
3. Events deduplicated via `knownIds` Set (prevents USGS+EMSC duplicates)
4. Sorted by recency, filtered by magnitude
5. Canvas-rendered on Leaflet CARTO dark map
6. User toggles sources, filters, catalog windows — map re-renders instantly

---

## 📂 Project Structure

```
global-quake/
├── index.html              # Entry point — viewport meta, touch-action, safe-area
├── package.json            # Vue 3 + Leaflet + Vite
├── vite.config.js          # Vite 6 + Vue plugin
├── LICENSE                 # MIT
├── README.md
└── src/
    ├── main.js             # Vue app create + mount
    ├── App.vue             # ~1500 lines: map, sidebar, stats, detail, legend, all UI
    └── utils/
        └── api.js          # URL builders, fetchers, normalizer, color scales, helpers
```

**Design choice:** A single `App.vue` monolith. For a dashboard this size (~1500 lines), splitting into 6+ components adds indirection without benefits. The data model is simple (one `events[]` reactive array), and the map/sidebar/detail all read from it directly — props drilling would be purely ceremonial.

---

## 🎨 Design & Inspiration

Built from scratch (MIT licensed). Studied architecture, UX, and visual design from these projects:

| Project | What We Learned |
|---------|-----------------|
| [kanameishi](https://github.com/Lipomoea/kanameishi) | Vue 3 + Leaflet integration, multi-source aggregation, depth-colored markers |
| [JQuake](https://jquake.net/) | Real-time intensity display, magnitude color scale, EEW UX patterns |
| [GlobalQuake](https://github.com/xspanger3770/GlobalQuake) | Info box UI, time range selector, SeedLink concept |
| [TREM-Lite](https://github.com/ExpTechTW/TREM-Lite) | SSE streaming, dark theme, intensity color palettes |
| [Zero-Quake](https://github.com/0Quake/Zero-Quake) | JMA intensity colors, Web Worker PGA detection concepts |

**No AGPL/GPL code was used.** All implementation is original.

---

## 🤔 FAQ

### Why another earthquake map?

Existing projects like kanameishi and GlobalQuake are excellent, but they're limited to single regions (Japan) or require backend servers (SeedLink, WebSocket relays). Global Quake is the only one that:

- Covers the entire planet
- Aggregates 5 independent free sources
- Runs as a pure static SPA (no backend, no API proxy)
- Works on mobile out of the box
- Costs $0 to run forever

### Why is it all in one file?

`App.vue` is ~1500 lines. For a project this size, the cost of component splitting (props, emits, provide/inject, coordination) exceeds the benefits. The data model is one reactive array shared by map, sidebar, stats, and detail — Vue's Composition API already provides clean separation via composable `ref`s and `computed`s. If the codebase grows to 3000+ lines, splitting would make sense.

### How does it handle rate limits?

USGS hosts public GeoJSON feeds with no rate limits. EMSC and GFZ are fair-use FDSN endpoints — at 60-second polling intervals (1 request per minute per source), you won't hit limits even on 24/7 monitoring. P2PQuake accepts anonymous WebSocket connections.

### Can I add more data sources?

Yes. Add a fetcher in `src/utils/api.js`, a `normalizeEvent()` branch, and a source toggle in `App.vue`'s `sourceOptions`. The `knownIds` deduplication works automatically.

---

## 🔮 Roadmap

- [ ] Audio alerts for M5.0+ events
- [ ] Historical replay mode
- [ ] 3D globe view (Cesium/Globe.GL)
- [ ] PWA offline support (service worker + cache)
- [ ] Tauri desktop app packaging
- [ ] MMI shake map overlay
- [ ] EEW (Earthquake Early Warning) integration for Japan
- [ ] Push notifications via Web Push API
- [ ] Timezone-aware timestamps
- [ ] CSV/GeoJSON export

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

## 🙏 Credits

Data courtesy of:
- [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/)
- [EMSC (European-Mediterranean Seismological Centre)](https://www.emsc-csem.org/)
- [GFZ German Research Centre for Geosciences](https://geofon.gfz-potsdam.de/)
- [GeoNet (New Zealand)](https://www.geonet.org.nz/)
- [P2PQuake](https://www.p2pquake.net/) — JMA seismic intensity data

Basemap tiles by [CARTO](https://carto.com/) (dark_all theme).

Built with ❤️ for the earthquake monitoring community.
