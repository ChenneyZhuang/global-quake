# Global Quake

Global Quake is a zero-backend, browser-based earthquake monitor built with Vue 3 and Leaflet. It aggregates public earthquake catalogs, renders a responsive world map, and provides lightweight monitoring tools for desktop and mobile.

The project is inspired by earthquake monitoring tools such as kanameishi, JQuake, TREM-Lite, GlobalQuake, and Zero-Quake, but the implementation here is original and designed to run as a static web app.

> Important: Global Quake is an informational monitoring dashboard. It is not an official earthquake warning service. Always follow local emergency agencies for safety decisions.

## Live Demo

[https://quakenow.duckdns.org:8445/](https://quakenow.duckdns.org:8445/)

## Highlights

- Global earthquake map powered by public data sources
- No API key, no backend, no database
- Vue 3 + Leaflet + Vite
- USGS, EMSC, GFZ/GEOFON, GeoNet, and P2PQuake/JMA support
- Japan live events through P2PQuake WebSocket
- Magnitude-first map markers with optional depth rings
- TV-style live focus for genuinely new M5.0+ events
- Historical replay mode for the selected catalog window
- M5+ audio alerts and local browser notifications
- Local/UTC timestamp toggle
- CSV and GeoJSON export
- PWA manifest and service worker for installable/offline app shell
- Mobile-first drawer layout and touch-friendly controls

## Current Feature Status

| Feature | Status | Notes |
| --- | --- | --- |
| Multi-source earthquake catalog | Implemented | USGS, EMSC, GFZ, GeoNet, P2PQuake/JMA |
| World map | Implemented | Leaflet + CARTO dark basemap |
| Infinite horizontal panning | Implemented | Wrapped marker copies around world boundaries |
| Magnitude markers | Implemented | Marker fill color and size prioritize magnitude |
| Depth rings | Implemented | Optional map layer, disabled by default |
| Live focus mode | Implemented | Auto-fly and broadcast lower-third for genuinely new M5.0+ events |
| M5+ audio alerts | Implemented | Browser AudioContext, user-enabled |
| Local notifications | Implemented | Uses browser Notification API while app is open |
| Timezone-aware timestamps | Implemented | Local/UTC toggle |
| CSV/GeoJSON export | Implemented | Exports current filtered catalog |
| Historical replay | Implemented | Timeline slider and play/pause controls |
| PWA offline shell | Implemented | Caches app shell and static assets |
| USGS ShakeMap panel | Basic | Loads ShakeMap intensity image when USGS publishes one |
| Japan EEW integration | Basic/live-info only | P2PQuake/JMA event stream; not a certified EEW service |
| Web Push API | Not yet | Needs a push subscription server |
| 3D globe | Not yet | Deferred until 2D UX is stable |
| Tauri packaging | Not yet | Deferred until web app stabilizes |

## Screens and Controls

### Top Bar

The top bar shows total events, M5+ and M7+ counts, live/loading state, catalog window, Japan live status, active sources, and the last update time.

### Sidebar

The sidebar contains:

- Catalog window selector: past hour, past 24 hours, past 7 days
- Magnitude filter
- Source toggles
- Map layer toggles
- Live focus M5+ toggle
- Historical replay controls
- CSV and GeoJSON export buttons
- Quick focus buttons for latest and strongest events
- Scrollable event list

### Map Markers

Global Quake uses a magnitude-first visual hierarchy:

- Marker fill color: magnitude
- Marker size: magnitude
- Marker outline: neutral by default
- Optional depth rings: depth shown as a cool colored outline
- New event highlight: temporary gold ring/glow

Depth is useful, but it is intentionally secondary because magnitude is what most users need first when scanning a live earthquake map.

### Historical Replay

Replay mode works on the current catalog window and current filters. Turn it on, drag the timeline, or press Play to watch events appear over time.

Replay is client-side only. It does not fetch archived datasets beyond the selected catalog window.

### Alerts and Notifications

Global Quake has two local alert types:

- M5+ sound: plays a short tone when a genuinely new M5.0+ event arrives
- Local notify: shows a browser notification for a genuinely new M5.0+ event when permission is granted

These are local browser features. They are not server-side Web Push notifications, so they do not wake a closed browser.

### Live Focus Mode

Live focus mode is inspired by monitoring-room and TV-live earthquake dashboards. When a genuinely new M5.0+ event arrives, the map automatically flies to the epicenter, opens the event popup, and shows a broadcast-style lower-third with magnitude, place, depth, time, and source.

Live focus only runs for fresh events detected after the initial load. It does not trigger when changing catalog windows, replaying history, or revealing older events from another source.

### ShakeMap Panel

For some USGS events, Global Quake can load a USGS ShakeMap intensity image from the event detail feed. This is shown as a panel, not as a georeferenced raster overlay yet.

Not every earthquake has a ShakeMap product.

### Japan Live / EEW Boundary

P2PQuake provides near-real-time Japan earthquake information derived from JMA-related public information. Global Quake labels those events as Japan live events.

This is not a formal Earthquake Early Warning service. The app does not promise certified alert timing, delivery, or life-safety behavior.

## Data Sources

| Source | Coverage | Protocol | Use |
| --- | --- | --- | --- |
| USGS | Global | GeoJSON feed | Main global catalog, source links, ShakeMap detail where available |
| EMSC | Global, Europe/Mediterranean strong | FDSN JSON | Independent catalog confirmation |
| GFZ/GEOFON | Global | FDSN GeoJSON | Independent global seismic catalog |
| GeoNet | New Zealand | REST GeoJSON | New Zealand regional catalog |
| P2PQuake/JMA | Japan | WebSocket | Near-real-time Japan events |

All data sources are public and do not require an API key. Fair-use behavior matters, so the app polls catalog sources on a conservative cadence.

## Tech Stack

- Vue 3 Composition API
- Leaflet 1.9
- Vite 6
- Browser WebSocket
- Browser Notification API
- Browser AudioContext
- Service Worker + Web App Manifest

## Project Structure

```text
global-quake/
├── index.html
├── package.json
├── public/
│   ├── manifest.webmanifest
│   ├── service-worker.js
│   └── icons/
│       ├── icon-192.svg
│       └── icon-512.svg
├── src/
│   ├── App.vue
│   ├── main.js
│   └── utils/
│       └── api.js
└── vite.config.js
```

## Development

```bash
npm install
npm run dev
npm run build
```

Preview the production build:

```bash
npm run build
npm run preview
```

The app is a static SPA. Anything that can serve the `dist/` folder can host it.

## Deployment

Build the project:

```bash
npm run build
```

Deploy the generated `dist/` directory to any static host:

- Nginx
- Caddy
- GitHub Pages
- Cloudflare Pages
- Netlify
- Vercel
- S3-compatible object storage

For SPA routing, configure fallback to `index.html` if you later add routes.

## PWA Notes

The service worker caches the app shell and same-origin static assets. It does not cache live earthquake API responses as authoritative offline data.

Offline behavior:

- Previously loaded app shell can open offline
- Live earthquake data requires network
- External map tiles may not be available offline

## Export Formats

### CSV

Columns:

```text
id,time_utc,magnitude,depth_km,latitude,longitude,place,source,mmi,felt,tsunami,url
```

### GeoJSON

Exports a `FeatureCollection` with Point geometries:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [longitude, latitude, depthKm]
      },
      "properties": {
        "magnitude": 5.2,
        "depthKm": 10,
        "place": "example",
        "source": "USGS"
      }
    }
  ]
}
```

## Design Decisions

### Why magnitude first?

Magnitude is the fastest way to understand event importance on a global earthquake map. Depth is useful, but making depth equally prominent makes the map visually noisy. Global Quake therefore defaults to magnitude fill and neutral rings, with depth rings available as an optional layer.

### Why a pure frontend app?

A static app is cheap to host, easy to fork, and safer to deploy. The tradeoff is that features like Web Push, durable alert delivery, and official EEW handling require a backend and are intentionally not presented as completed here.

### Why Canvas markers?

The catalog can contain hundreds of events. Leaflet Canvas rendering is smoother than hundreds of SVG/DOM markers, especially on mobile.

## Limitations

- Not an official emergency alert system
- No guaranteed delivery for audio or local notifications
- Web Push requires future backend work
- ShakeMap is only available for events where USGS publishes a product
- P2PQuake/JMA integration is live earthquake information, not certified EEW
- External APIs and map tiles require network access

## Roadmap

### Near Term

- Improve historical replay labels and speed controls
- Add settings persistence with `localStorage`
- Add mobile-specific notification onboarding
- Improve ShakeMap product detection and fallback links

### Later

- Web Push server and subscriptions
- Proper georeferenced MMI raster overlay
- Stronger Japan EEW integration with clearer source attribution
- Optional 3D globe view after 2D map UX stabilizes
- Tauri desktop packaging after web app behavior stabilizes

## Credits

Data sources:

- [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/)
- [EMSC](https://www.emsc-csem.org/)
- [GFZ/GEOFON](https://geofon.gfz-potsdam.de/)
- [GeoNet](https://www.geonet.org.nz/)
- [P2PQuake](https://www.p2pquake.net/)

Map tiles:

- [CARTO Dark Matter](https://carto.com/)
- [OpenStreetMap contributors](https://www.openstreetmap.org/)

Project inspiration:

- [kanameishi](https://github.com/Lipomoea/kanameishi)
- [JQuake](https://jquake.net/)
- [TREM-Lite](https://github.com/ExpTechTW/TREM-Lite)
- [TREM-tauri](https://github.com/ExpTechTW/TREM-tauri)
- [EarthQuakeWarning](https://github.com/kengwang/EarthQuakeWarning)
- [Zero-Quake](https://github.com/0Quake/Zero-Quake)

## License

MIT. See [LICENSE](LICENSE).
