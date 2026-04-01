# Mission Control Usage Collector - Javítási Terv

## Probléma

A collector HTTP kéréseket küld a Gateway-nek, de az csak HTML UI-t ad vissza JSON helyett.

## Ok

A Gateway (`http://127.0.0.1:18789`) REST API helyett HTML UI-t ad:
- `/health` → JSON ✅
- `/cron` → HTML ❌
- `/sessions` → HTML ❌
- `/api/cron` → 404 ❌

## Megoldás

### 1. Brain V2 API használata

A Brain V2 (`http://127.0.0.1:3322`) elérhető és JSON-t ad vissza:
- `/health` → JSON ✅
- `/memory/recall` → JSON ✅
- `/context/get` → JSON ✅
- `/decision/log` → JSON ✅

### 2. OpenClaw Tool System

A `cron` és `sessions_list` tool-ok csak OpenClaw session-ben működnek:
```javascript
// OpenClaw session-ben:
cron list
sessions_list
```

### 3. Javasolt megközelítés

**Mission Control Dashboard:**
- Brain V2 adatok (uptime, memory, tools) ✅
- PostgreSQL adatok (emlékek) ✅
- Rendszer adatok (diszk, load) ✅
- Cron/Sessions: **kivonni a dashboard-ból** vagy **OpenClaw cron-t használni**

## Jelenlegi Állapot

| Adatforrás | Státusz | Megjegyzés |
|------------|---------|------------|
| Brain V2 | ✅ | JSON API működik |
| PostgreSQL | ✅ | 3167 emlék |
| Diszk | ✅ | 92% teli |
| Cron jobs | ❌ | HTML válasz |
| Sessions | ❌ | HTML válasz |

## Következő Lépés

A Mission Control dashboard egyszerűsítése: csak Brain V2 + PostgreSQL + rendszer adatok.

**Felelős:** Morzsa
**Dátum:** 2026-04-01