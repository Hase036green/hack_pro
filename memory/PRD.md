# ARCHER GRID - Signal Command Center

## Problem Statement (Original, German)
> ich habe mir einen neuen Rauter gekauft ac1300 tplink archer 6 und ich will eine app
> die es mir ermoeglich wenn ich den router per kabel an mein laptop anschliesze
> automatisch erkannt wird und die app soll dazu dienen das ich mit den signalen
> von dem router kann dienge im raum erkennen oder auch auszer dem raum also
> jenachdem wie stark die stralung geblock wird, und danach soll dann das 3d
> bild system was anzeigen in live und ich will das ich mein router komplett
> uebernehmen kann und das alles schoen angezeigt wird mach deine beste vision mal 2

## User Choices (Iteration 1)
- 1c: Demo + Live-Modus parallel (Live-Felder vorbereitet)
- 2b: Sci-Fi Hologramm (Tron-like, transparente cyan/blaue Hologramme)
- 3c: Heatmap + 3D Punktwolke kombiniert
- Deutsch UI
- Single Admin Login (kein Multi-User)

## Personas
- **The Operator** (admin): einzelner Power-User, der seinen TP-Link Archer C6 übernehmen und Raum-Sensorik betreiben möchte.

## Architecture
- **Backend** FastAPI + MongoDB
  - JWT Auth (Bearer + httpOnly cookie), bcrypt, single seeded admin
  - In-memory ROUTER_STATE + DEVICES + DETECTION_LOG (Demo)
  - Mathematische Signal-Simulation (RSSI-Falloff + Objekt-Attenuation)
  - WebSocket `/api/ws/live` (Live-Stream, 0.8s tick) mit Polling-Fallback alle 5s
  - Optionaler echter Router-Reach mit `httpx` (Live-Modus probiert HTTP GET auf 192.168.0.1)
- **Frontend** React 19 + react-three-fiber 9.6 + three.js 0.170
  - Orbitron / Rajdhani / JetBrains Mono Fonts
  - Tron-Hologramm Tema: cyan #00f0ff auf dunklem #030712, Clip-Path-Ecken, Scanlines, Glow
  - Recharts für 2D Charts
  - `craco.config.js`: `@emergentbase/visual-edits` deaktiviert (inkompatibel mit r3f 9.x applyProps)
- **Auth**: admin@archer.local / archer1300 (in `/app/memory/test_credentials.md`)

## What's Been Implemented (2026-02-18)
- [x] Holographisches Operator-Login (`/login`) inkl. Boot-Sequenz-Animation
- [x] Hardware-Scan-Sequenz mit Kabel-Diagnose (`/detect`)
- [x] Router-Übernahme: Demo-Modus + Live-Modus Vorbereitung (IP + Admin-Passwort Felder)
- [x] 3D Command Center Dashboard (`/dashboard`)
  - 6 Live-Stat-Tiles (Router-Status, Modus, Uptime, Geräte, Objekte, Avg RSSI)
  - 3D Hologramm-Raum: Drahtgitter, Router-Modell mit Antennen, expandierende Signalringe,
    Radar-Sweep, Heatmap-Punktwolke, Geräte-Marker, Objekt-Marker mit Boden-Projektion
  - Erkannte Objekte Live-Panel
  - Object Detection Console (Log-Stream)
- [x] Geräteverwaltung (`/devices`): 6 mock Clients, Signal-Bars, Blockieren/Freigeben
- [x] Signal-Analyse (`/analytics`): RSSI-Verlauf, Kanal-Auslastung, Frequenz-Spektrum
- [x] Router-Steuerung (`/control`): WLAN-Config (SSID 2.4G/5G, Kanäle, TX-Power), Status, Notfall-Restart
- [x] Object Detection Console (`/security`): Live-Console, Sensor-Telemetrie, Aktive Tracker
- [x] Voller Sci-Fi-Tron-Look: Clip-Paths, Glow, Scanlines, animierte Sweeps, Custom Scrollbar
- [x] JWT Auth (Bearer + Cookie), Protected Routes, Logout
- [x] 19/19 Backend Tests + 100% Frontend E2E

## Backlog (Prioritized)
### P0 - Blocking / Next Iteration
- (keine)

### P1 - Nice to have
- Echte TP-Link Archer C6 Admin-Panel Integration (Reverse-Engineering tplinkwifi.net Login + Cookie + Encryption Path) - aktuell nur HTTP-Reach Test
- WiFi-Sensing via externer Hardware-Bridge (z. B. Raspberry Pi mit Nexmon CSI patched firmware), das echte CSI an Backend streamt
- Persistente Settings/Logs in MongoDB (statt In-Memory)
- Multi-Theme (Cyberpunk Radar / Lab variants)
- Heatmap mit echter 3D Voxel-Visualisierung statt nur Boden-Punkten

### P2 - Future
- Mobile-optimiertes Layout
- Audio-Feedback bei Objekt-Erkennung (Beeps)
- Export von Detection-Logs als CSV/JSON
- Optional: Multi-User mit Rollen (admin / viewer)
- Raum-Kalibrierung (manuelle Möbel/Wand-Marker per Klick im 3D-Raum)

## Tech-Notes / Decisions
- react-three-fiber 9.6 + drei 10.0.0 + three 0.170 (kompatibel mit React 19, Node 20)
- visual-edits Babel-Plugin deaktiviert: bricht r3f applyProps durch `data-loc-*` Attribute
- WebSocket-Auth via Query-String `?token=...` (keine Cookies bei WS-Handshake möglich)
- Bewegungs-Erkennung approximiert: RSSI-Falloff mit log10 + Objekt-Attenuation in Range,
  Confidence aus Sinus-Phasenverschiebung. Echte CSI nicht verfügbar bei stock Archer C6.

## Files of Interest
- `/app/backend/server.py` – komplette API + Simulation
- `/app/frontend/src/components/holo/Holo3DRoom.jsx` – 3D Szene
- `/app/frontend/src/pages/Login.jsx` – Hologramm-Gateway
- `/app/frontend/src/pages/Detect.jsx` – Hardware-Scan
- `/app/frontend/src/pages/Dashboard.jsx` – Haupt-HUD
- `/app/frontend/craco.config.js` – visual-edits Plugin deaktiviert
- `/app/memory/test_credentials.md` – Admin-Credentials
