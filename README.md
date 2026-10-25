# AFTERSHOCK — Real-Time Multiplayer Sci-Fi Arena

AFTERSHOCK is an authoritative real-time browser game built for 2–6 players. Pilots share a futuristic reactive grid arena, harvesting dynamic energy nodes and banking score in shifting Flux Conduits while dodging propagating seismic shockwaves.

---

## 🎮 Live Public URL
- **Live Game URL (Cloudflare Global Edge)**: [https://her-springer-raising-painting.trycloudflare.com](https://her-springer-raising-painting.trycloudflare.com)
- **Local Dev URL**: `http://localhost:3001`
- **Health Check**: `https://her-springer-raising-painting.trycloudflare.com/api/health`

---

## 🕹️ Controls

### Desktop Controls
| Key | Action |
|---|---|
| `W`, `A`, `S`, `D` or `Arrow Keys` | Continuous 360° thruster vector navigation |
| `Space` or `E` | Trigger character class ability |
| `Mouse / Click` | UI selection, character customization, ready toggle |

*Note: Default browser scrolling on arrow keys and spacebar is automatically intercepted and suppressed during active matches.*

### Mobile & Tablet Controls
| Control | Action |
|---|---|
| **Virtual Thumbstick** (Bottom Left) | Dynamic analog thumbstick for direction and speed |
| **Haptic Ability Button** (Bottom Right) | Ergonomic thumb button with radial cooldown countdown sweep |
| **Touch Academy** | Drag-to-fly navigation in the single-player Flight Academy |

---

## ⚡ Core Game Mechanics

### 1. Authoritative 20Hz Server Netcode
- Node.js + Express + Socket.io running a deterministic 20 Hz tick loop (50ms interval).
- Server validates player boundaries, collisions, energy harvesting, seismic shockwaves, and ability cooldowns.
- Automatic disconnection and session restoration using client reconnection tokens stored in `localStorage`.
- Multiple independent rooms running concurrent, isolated simulations with unique 6-character room codes (e.g. `ASW-J6X`) and optional password protection.

### 2. Six Distinct Pilot Character Classes
1. **Phase Dasher (`BLINK`)**: Warp 3.5 grid units in movement direction; invulnerable to seismic rifts during transit (Cooldown: 5.0s).
2. **Kinetic Brawler (`SHOCKWAVE`)**: Radial kinetic shockwave repelling rival pilots and clearing territory. Unshielded rivals are knocked back and stunned (Cooldown: 6.5s).
3. **Aegis Defender (`SHIELD`)**: 2.5s impenetrable energy barrier that nullifies hazard stuns, damage, and rival shockwaves (Cooldown: 8.0s).
4. **Graviton Weaver (`VORTEX`)**: Deploy a 4s gravitational singularity that vacuums energy sparks and slows enemy traversal by 60% while pulling them towards its center (Cooldown: 7.5s).
5. **Overcharger (`SURGE`)**: Boosts movement speed by +65% and doubles all collected energy points for 3.5s (Cooldown: 8.5s).
6. **Rift Engineer (`MINE`)**: Primed seismic landmine that detonates into an immediate Aftershock when stepped on by a rival (Cooldown: 7.0s).

### 3. Dynamic Arena Hazards & Objectives
- **Dynamic Energy Sparks**: Spawns standard (+10), super (+20), and golden (+40) energy nodes across the arena.
- **Flux Conduits (Pylons)**: Shifting $3 \times 3$ charging beacons that award continuous points. If multiple rival pilots occupy the zone simultaneously, the objective is marked **CONTESTED** and charging halts until contested pilots are repelled. Fully charging awards +50 bonus points and an Overcharge Surge boost.
- **The "Aftershock" Hazard**: Periodic seismic epicenters telegraph danger patterns (crosses, beams, expanding concentric rings) before erupting into shockwaves that stun unshielded pilots and scatter 30% of their energy cores for opponents to scavenge.
- **Sudden Death Overtime**: If the top score is tied when the match clock expires, a 30-second Sudden Death Overtime activates with double hazard frequency.

### 4. Interactive Flight Academy (Tutorial)
- Standalone single-player guided training course:
  - **Stage 1**: Ship Navigation & Checkpoint Beacons
  - **Stage 2**: Energy Spark Harvesting
  - **Stage 3**: Aftershock Wave Dodging
  - **Stage 4**: Ability Mastery
  - **Stage 5**: Practice Drone Sparring Match with timer and AI sparring dummy

### 5. Responsive UI/UX & Audio
- Hardware-accelerated HTML5 Canvas rendering at 60 FPS with client interpolation between 20Hz server updates.
- Obsidian dark theme with electric cyan and neon violet accents.
- Procedural Web Audio API sound synthesizer for all sci-fi sound effects (zero external audio file latency).

---

## 🛠️ Testing & Execution Commands

```bash
# 1. Install dependencies
npm install

# 2. Run automated multiplayer simulation test suite
npm run test:sim

# 3. Run comprehensive E2E match & netcode test
npx tsx tests/e2e-match-test.ts

# 4. Run deep 9-scenario audit test suite (All 6 abilities, contesting, sudden death, host kick, rematch, input sanitization)
npx tsx tests/comprehensive-audit-test.ts

# 5. Run live public cloud match test over Cloudflare Edge
npx tsx tests/e2e-public-match-test.ts

# 6. Build production frontend client
npm run build

# 7. Start authoritative production server
npm start
```

---

## 🐳 Deployment Configurations

- **Render**: `render.yaml` provided for free 1-click cloud service.
- **Docker**: `Dockerfile` multi-stage Alpine build for Fly.io, Railway, or Google Cloud Run.
- **Cloudflare Tunnel**: `cloudflared.exe` quick tunnel configured for instant public URL access without port forwarding.

---

## ⚠️ Known Environmental Limitations
- Public Quick Tunnels (`trycloudflare.com`) depend on Cloudflare's public edge routing. For permanent custom domains, supply a Cloudflare Tunnel token via `CLOUDFLARE_TUNNEL_TOKEN` or deploy via the included `render.yaml` / `Dockerfile`.
