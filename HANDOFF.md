# Global Quake — Handoff

> 给接手者（Hermes / Codex / 未来的自己）：这份文件是**做事前先读**的入口。
> 最后更新：2026-09-10 by Hermes

---

## 1. 这是什么

纯前端、零后端、零 API key 的全球实时地震监测 Web App。

- **技术栈**：Vue 3 (Composition API) + Leaflet 1.9 + Vite 6
- **形态**：静态 SPA，`dist/` 丢任何静态服务器就能跑
- **灵感来源**：kanameishi（用户明确说"就是看了这个想做一个的"）、JQuake、TREM-Lite/TREM-tauri、EarthQuakeWarning、Zero-Quake
- **代码规模**：`src/App.vue` 2879 行（几乎全部逻辑/模板/样式都在这里），`src/utils/api.js` 343 行
- **LICENSE**：MIT

> ⚠️ `App.vue` 是个 2879 行的巨石单文件。改之前先 `read_file` 定位行号，别凭记忆改。
> 想拆组件的话这是第一优先重构项，但**不要在没有明确需求时主动拆**。

## 2. 数据来源（全部免费公开，无需 key）

| 源 | 区域 | 端点 |
|---|---|---|
| USGS | 全球主力目录 | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{all_hour,all_day,all_week,2.5_day,2.5_week,4.5_week,significant_month}.geojson` |
| EMSC | 全球，欧洲/地中海强 | `https://www.seismicportal.eu/fdsnws/event/1/query` |
| GFZ/GEOFON | 全球 | `https://geofon.gfz-potsdam.de/fdsnws/event/1/query` |
| GeoNet | 新西兰 | `https://api.geonet.org.nz/quake` |
| P2PQuake/JMA | 日本近实时 | WS `wss://api.p2pquake.net/v2/ws`；历史 `https://api.p2pquake.net/v2/history` |
| NIED 强震监视 | 日本 | 公开图片端点（`kmoni.bosai.go.jp`，已改 https） |
| ISC FDSNWS | 备用 | `http://www.isc.ac.uk/fdsnws/event/1/` |

源清单参考：`https://github.com/YacineBoussoufa/EarthquakeDataCenters`（找非洲/中东/俄罗斯源从这里查，Codex 之前就是按这个补的）

**刷新节奏**：目录轮询 **60 秒**（`CATALOG_POLL_MS`，feed 缓存 55 秒），P2PQuake JMA WebSocket 是实时流。NIED 面板默认关闭，点开才拉。

## 3. 已经踩过的坑（别再踩）

| 坑 | 真相 |
|---|---|
| P2PQuake 震级读不到 | 真实数据在 `earthquake.hypocenter.magnitude`，**不是** `earthquake.magnitude`。事件 id 优先用消息顶层 `msg.id` |
| 时间范围切换误报"新地震" | 切 `Past 7 days` 会把整屏旧事件当新事件弹 alert + 金色高亮。已修成"切窗口 ≠ 新事件" |
| 列表点击不弹地图 popup | 根因是经纬度近似匹配 layer + Leaflet 重绘丢引用。改成列表点击直接在该坐标开同内容 popup；索引键统一转 string |
| 新地震条被左边竖条挡住 | `.alert-bar` 从 `left:42px` 起，侧栏展开时切 `.shifted` 到 `left:320px` |
| 未知深度当 0km 浅源 | 未知深度不能套红色浅源颜色 |
| NIED 图片线上加载失败 | `http` 改 `https`，否则 HTTPS 页面 mixed content 被拦 |
| 8443 端口 server_name 冲突 | `quakenow.conf` 和 `webdav-ssl.conf` 都声明了 `chenneyyu.duckdns.org` on 8443 → nginx 一直告警 `conflicting server name ... ignored`。**已修**：quakenow 只保留 8445 |
| GFZ 源返回 0 条数据 | GFZ FDSNWS **不支持** `format=json/geojson`（HTTP 400 "invalid value in parameter: format"），只有 `format=text`。已改 `fetchGFZ()` 请求 text 并用 `parseGfzText()` 解析 pipe 表格（实测 24h 14 条，0 畸形）。旧代码静默失败，顶栏却一直显示 GFZ 在贡献数据 |
| EMSC `format=geojson` 也是 400 | EMSC 只接受 `format=json`（返回 GeoJSON FeatureCollection），别改 |
| EMSC/GFZ 事件没有详情链接 | 两家都没有可读的 per-event 网页（`/event/{id}` 全 404）。已用 FDSN `eventid=` 查询端点合成 "Source page" 链接 |
| JMA 震度被压平 | 旧 `convertJmaScale` 是 `ceil(scale/10)`，把 25/30/35 全变 3。已换 `api.js` 的 `jmaScaleToIntensity()` 完整 11 级表（弱/やや強い/かなり強い/激しく…） |
| P2PQuake 556（EEW）被丢弃 | 旧代码 `if (msg.code !== 551) return`。556 是带各县震度 + 到达时间的预警公告，已接 `handleEewBulletin()` + EEW 面板 |
| kmoni.bosai.go.jp 连不上 | 实测 TCP 443 超时（日本服务器，海外网络大概率连不上）。面板会优雅降级，别以为是代码坏了 |

## 3.5 2026-09-11 功能轮（全部已实测）

这轮加了什么（按用户"全都弄了"指令）：

| 功能 | 实现 |
|---|---|
| **GFZ 源救活** | `api.js`: `gfzTextUrl()` + `parseGfzText()`，`fetchGFZ()` 读 text；GFZ/GFZ 分支的 `normalizeEvent` 保持兼容 |
| **源健康状态** | `sourceHealth` ref：`ok/empty/error/stale`，`sourceLastOk` 记录成功时间，3 分钟无数据自动 `stale`（`markStaleSources()`）。UI 在 Sources 按钮上：红=error（划线）、黄=empty，hover 有 title 提示 |
| **多源交叉验证徽章** | `dedupeEvents` 已把同震源合并成 `"USGS + EMSC"` 标签。`sourceCount()` 数 `+`，≥2 时列表和详情面板显示绿色 ✓N 徽章 |
| **日本 EEW 面板** | P2PQuake code 556：`handleEewBulletin()` 解析 `areas[]`（各县 scaleFrom/scaleTo→震度标签），`.eew-panel` 显示最大震度 + 分县表 + cancelled 状态 + "not certified" 声明 |
| **JMA 震度分级** | `jmaScaleToIntensity()` 11 级表；551 事件带 `intensityLabel`；列表/详情显示英文标签 |
| **P/S 波到达估算** | "Wave times for me" 开关（需用户授权定位）。`greatCircleKm()` + `computeWaveStatus()`，`.wave-panel` 显示距离 + P/S 双进度条 + 文案（"P wave arriving in Ns" / "Both waves passed"）。**uniform 波速是估算**，kanameishi 用 JMA/JB 走时表按深度插值——我们没有表，注释里写明了 |
| **设置持久化** | `localStorage` `global-quake:settings:v1`，watch 防抖 150ms 存 9 个关键 ref（feed/sources/magFilter/depthRings/audio/liveFocus/timeMode/sidebar/legend） |
| **Leaflet 本地 bundle** | `import 'leaflet/dist/leaflet.css'` 进 App.vue，index.html 删掉 unpkg CDN link。unpkg 挂了不再白屏 |

**验证记录**：
- `npm run build` 通过（dist JS 266KB / CSS 39KB，17 modules）
- `verify_waves.mjs`（已删）：从 App.vue 源码提取 `greatCircleKm`/`computeWaveStatus` 真函数体跑 22 个断言，**22/22 过**（4 组 haversine 已知距离、NaN guard、近/远震 P/S 状态、边界 null/future）
- GFZ：`node` 直接调 `fetchGFZ` 真端点，24h 返回 14 条 0 畸形
- Chrome headless 截图（1440x900）+ ffmpeg 像素采样：全部 6 档震级 marker 颜色渲染 ✓、徽章绿 #7fe0a4 ✓、活动源 #77bdff ✓、CARTO 暗色底图 0% 亮像素 ✓
- wave-panel `top:84px`（alert-bar 在 top:46 left:42，会叠）；strong-motion-panel 在右侧不冲突

**没做的**（用户睡觉前授权"按你的理解"）：
- A2 NIED 换源：没找到可靠替代端点，不敢乱换
- kanameishi 的 `drawReachBar` SVG 环形进度条：我们用横向双进度条代替，视觉更简单
- kanameishi 的告警三级分级（CSIS/震级/距离）+ 音高节奏组合：现有 M5+ 单一告警没动，改动面太大
- 子代理提的 3 个创新功能（90 天趋势线 / 历史同日 / 震级差异条）：没做，候选在 delegate 记录里


## 4. 部署状态 ⚠️ 当前线上是坏的

**线上地址**：`https://quakenow.duckdns.org:8445/`

**当前状态（2026-09-10 21:08）**：HTTP **502**，站点不可用。

### 根因
旧 `quakenow.conf` 把 `/` 反代到 `127.0.0.1:8081` —— 那是 Codex **临时**跑的 `vite preview`。进程一停（它本来就该停），nginx 就 502。error.log 里清一色：
```
kevent() reported that connect() failed (61: Connection refused) while connecting to upstream,
client: ..., server: quakenow.duckdns.org, upstream: "http://127.0.0.1:8081/"
```
nginx 本身是好的、TLS 是好的、DuckDNS 是好的（当前公网 IP `115.130.203.99`，和日志一致）。**只有 upstream 不在了。**

纯静态 SPA 根本不该走反代。

### 已做的修复（配置已写入，**等 reload 生效**）
`/opt/homebrew/etc/nginx/servers/quakenow.conf` 已改写为直接 serve 静态文件：

```nginx
listen 8445 ssl;                    # 只保留 8445，不再抢 8443
server_name quakenow.duckdns.org;
root /Volumes/SSD/global-quake/dist;
location / { try_files $uri $uri/ /index.html; }
```
另加了：`/assets/` 缓存 30 天 immutable；`service-worker.js` 与 `manifest.webmanifest` 强制 no-cache（否则 PWA 更新到不了用户）；nosniff / referrer-policy。

### 你需要跑的这一条命令
nginx master (PID 268) 是 root，Homebrew launchd 起的，我这边 sudo 要密码。请手动跑：

```bash
nginx -s reload
```

然后验证（全绿就完事）：

```bash
curl -sk -o /dev/null -w "%{http_code}\n" https://127.0.0.1:8445/                 # 期望 200
curl -sk -o /dev/null -w "%{http_code}\n" https://quakenow.duckdns.org:8445/       # 期望 200
tail -5 /opt/homebrew/var/log/nginx/error.log                                     # 不该再有 8081
```

### 顺带说明（不用动）
- `9443/pool/` 也是 502，因为 `127.0.0.1:5174` 的 Pool Scout 开发服务器没在跑。那是另一条线的事，**别在这修**。
- `webdav-ssl.conf` (9443 → docker 8082) 正常，302 OK。
- DuckDNS 每 5 分钟自动更新（`~/Library/LaunchAgents/com.duckdns.update.plist`），域名 `chenneyyu`，域名 `quakenow` 是挂在 `chenneyyu` 的 letsencrypt 证书下的（`/Users/chenney/letsencrypt/config/live/chenneyyu.duckdns.org/`）。

## 5. GitHub 状态

- **仓库**：`https://github.com/ChenneyZhuang/global-quake`
- **可见性**：**PUBLIC**（你记对了，确实是公开的）
- **创建**：2026-06-18 13:12 UTC
- **默认分支**：`main`
- **LICENSE**：MIT
- **统计**：1 star，0 fork，0 watcher
- **Issues / PRs / Releases**：**全部 0 个**（从没开过）
- **GitHub Pages**：**未启用**（API 404）

### 本地 vs 远端
```
HEAD        = 874d43e ✨ Refine live focus and sensor monitor
origin/main = 874d43e  ← 完全同步，工作树干净
```
**已经没有"没上传"的东西了。** 8/19 那次 Codex 被它自己的安全审核拦住 push（理由：未验证归属的远端），你当时回了一句"允许推送到这个 GitHub main 分支"，之后就推上去了。

完整提交历史只有 4 个：
```
874d43e ✨ Refine live focus and sensor monitor
79eec36 ✨ PWA support, audio alerts, desktop notifications, JMA live indicator (Codex)
d4c71ee 📝 Comprehensive README: architecture, FAQ, 5 data sources, zero-cost
26acc86 🌍 Global Quake — real-time worldwide earthquake monitor
```

## 6. 功能状态

| 功能 | 状态 |
|---|---|
| 多源目录（USGS/EMSC/GFZ/GeoNet/P2PQuake） | ✅ 已实现 |
| 世界地图 + 无限横向平移（跨界 marker 环绕） | ✅ 已实现 |
| 震级优先 marker（半径 ∝ mag²，深度环可选、默认关） | ✅ 已实现 |
| 日本 NIED 强震监视面板 | ⚠️ 基础（默认关，点开才拉） |
| Live Focus 电视直播式聚焦（真新 M5.0+） | ✅ 已实现 |
| M5+ 音频告警（AudioContext，用户开启） | ✅ 已实现 |
| 本地浏览器通知 | ✅ 已实现 |
| 本地/UTC 时间切换 | ✅ 已实现 |
| CSV / GeoJSON 导出 | ✅ 已实现 |
| 历史回放（时间轴 + 播放） | ✅ 已实现 |
| PWA manifest + service worker 离线壳 | ✅ 已实现 |
| USGS ShakeMap 面板 | ⚠️ 基础（USGS 发了才加载，非地理配准栅格） |
| 日本 EEW | ⚠️ 仅 live-info，**不是**认证 EEW |
| Web Push | ❌ 未做，需要订阅服务端 |
| 3D 地球（Cesium/Globe.GL） | ❌ 未做，等 2D 稳 |
| Tauri 桌面打包 | ❌ 未做，等 web 稳 |

## 7. 下一步建议（按性价比排序）

1. **（30 秒）reload nginx 恢复线上** — 见 §4。这是最该先做的。
2. **启用 GitHub Pages** 作为备用/永久托管 — 仓库已 public 且仓库已授权，一条命令的事。之后就算 Mac mini 不在线，站点也活着。目前仓库没开 Pages。
3. **开 GitHub Issues 追踪** — 仓库 0 issue。README 的 Roadmap 已经列好了，直接搬成 issue。
4. **拆 `App.vue`** — 2879 行单文件。按 kanameishi 的组织方式拆 `MainMap` / `Eqlist` / `Status` / `Settings` 组件。**不要主动做，等用户说要。**
5. **`localStorage` 持久化设置** — README Roadmap 第一项。
6. **ShakeMap 产品检测 + fallback 链接** — README Roadmap 第四项。

## 8. 开发命令

```bash
cd /Volumes/SSD/global-quake
npm run dev      # http://127.0.0.1:5173
npm run build    # 产出 dist/，666ms 左右，已验证通过
npm run preview  # 预览生产构建 — 注意：这是临时的，别拿它当线上 upstream
```

`dist/` 在 `.gitignore` 里（第 2 行），**不提交**。nginx 直接读工作区的 `dist/`，所以 build 完即可见。

## 9. 用户偏好（做这个项目时）

- 参考 kanameishi 优先，这是用户的项目起点
- UI 词汇要**有语义**，不要 `1h / 1d / 1w` 这种开发者黑话 → 用 "Past hour / Past 24 hours / Past 7 days"
- **地图 marker 里标字，圆圈内颜色 = mag，圈 = 深度**（用户原话："不要标字圆圈中间颜色是mag圈是深度，深度不是很重要"）
- 深度默认关，做成开关
- 新地震条**只跳真正新的事件**，绝不跳历史/窗口切换
- 手机端要单独优化（用户反复强调）
- 地图 zoom +/- 控件不能被任何浮层挡住
