# 🌍 Global Quake

**Real-time worldwide earthquake monitor. Zero API cost. No backend.**

Built with Vue 3 + Leaflet. Dark-themed, mobile-responsive, WebSocket + 5-second polling for near-real-time updates.

👉 **Live demo:** https://quakenow.duckdns.org:8445/

## ✨ Features

- **Near real-time** — 5s USGS polling + P2PQuake WebSocket for Japan (JMA data, seconds delay)
- **Global coverage** — every earthquake M1.0+ worldwide from USGS
- **New earthquake alerts** — notification bar pops in with gold-highlighted markers when fresh events appear
- **Dark theme UI** — glass-morphism panels, designed for 24/7 monitoring
- **Mobile responsive** — hamburger drawer sidebar, collapsible legend, bottom-sheet detail panel
- **Magnitude-colored badges** — JQuake-inspired green→yellow→orange→red→purple scale
- **Depth-colored markers** — shallow (red) to deep (blue) at a glance
- **Zoom-scaled circles** — markers shrink at world view, grow when zoomed in
- **MMI intensity display** — Modified Mercalli Intensity with Roman numerals
- **World-wrapping map** — free horizontal scrolling with worldCopyJump
- **Interactive sidebar** — scrollable event list, magnitude filter, source display
- **Time range tabs** — Past Hour / Past Day / Past Week

## 🚀 Quick Start

```bash
cd global-quake
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build → dist/
```

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Build | Vite 6 |
| Map | Leaflet 1.9 + CARTO dark_all basemap |
| Real-time | WebSocket (P2PQuake/JMA) + 5s polling (USGS) |
| Deployment | Static SPA, served via nginx + Let's Encrypt SSL |

## 📡 Data Sources

| Source | Coverage | Update | Protocol |
|--------|----------|--------|----------|
| **USGS** | Global M1.0+ | ~1-5 min | GeoJSON Feed (polling, 5s) |
| **P2PQuake/JMA** | Japan region | < 5 seconds | WebSocket (code 551) |

All data is **free and public domain** — no API keys required.

## 📂 Project Structure

```
global-quake/
├── index.html              # Entry point with viewport meta + touch-action
├── package.json
├── vite.config.js          # Vite 6 + Vue plugin
├── LICENSE                 # MIT
├── README.md
└── src/
    ├── main.js             # Vue app mount
    ├── App.vue             # Map + sidebar + stats + detail panel + legend
    └── utils/
        └── api.js          # USGS fetching, P2PQuake WS, color scales, helpers
```

## 🎨 Design References

Built from scratch (MIT licensed). Studied architecture and UX concepts from:

| Project | What We Learned |
|---------|-----------------|
| [kanameishi](https://github.com/Lipomoea/kanameishi) | Vue 3 + Leaflet, multi-source aggregation, depth-colored markers |
| [JQuake](https://jquake.net/) | Real-time intensity display, magnitude color scale, EEW UX |
| [GlobalQuake](https://github.com/xspanger3770/GlobalQuake) | Info box UI, time range selector, SeedLink concept |
| [TREM-Lite](https://github.com/ExpTechTW/TREM-Lite) | SSE streaming, dark theme, intensity color palette |
| [Zero-Quake](https://github.com/0Quake/Zero-Quake) | Web Worker PGA detection, JMA intensity colors |

**No AGPL/GPL code was copied.** All implementation is original.

## 🔮 Roadmap

- [ ] EMSC FDSN integration for European coverage
- [ ] GFZ/GEOFON global catalog supplement
- [ ] Audio alerts for M5.0+ events
- [ ] Historical replay mode
- [ ] 3D globe view (Cesium)
- [ ] PWA offline support
- [ ] Tauri desktop app packaging

## 📄 License

MIT — see [LICENSE](LICENSE)

---

Built with ♥ for the earthquake monitoring community.  
Data courtesy of [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/).
