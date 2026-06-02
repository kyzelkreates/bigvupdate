# Big V’s Best Routes — Starter Build Package

Safety-first all-vehicle trip planning + Navigation PWA starter created for Base44 / Super Agent finishing work.

## What is included

- React + Vite PWA shell
- `storage.js` local-first Single Source of Truth
- Modular all-vehicle input page
- Vehicle type templates/config
- Compliance AI rules-led advisory engine
- GraphHopper adapter placeholder
- Driver Trip Planning Dashboard
- 3D Google-Maps-style navigation dashboard shell using original Big V UI
- Route polyline visual shell
- Vehicle marker/icon shell
- GPS/offline/status UI
- Service worker and manifest

## Safety rule

Big V’s Best Routes must remain advisory only. It must never guarantee that a route is legal. Road signs, local restrictions, police instructions, and driver judgement override app guidance.

## Local dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Main files

```txt
src/core/storage.js                  Local-first SSOT
src/config/vehicleTemplates.js       Modular vehicle fields by vehicle type
src/core/complianceEngine.js         Rules-led advisory compliance checks
src/core/graphHopperAdapter.js       Isolated GraphHopper provider adapter
src/pages/PlannerDashboard.jsx       Driver trip planning dashboard
src/pages/NavigationPWA.jsx          In-journey navigation PWA shell
src/components/NavigationMapShell.jsx 3D map dashboard visual shell
src/styles/app.css                   Big V visual design system
```

## Base44 finish-off prompt

Copy this into Base44 / Super Agent after uploading the zip:

```txt
⛔ STRICT BASE44 / SUPER AGENT ENFORCEMENT RULES — READ FIRST

FIX-ONLY BUILD COMPILER MODE.

PROJECT:
Big V’s Best Routes — Safety-First All-Vehicle Trip Planning + Navigation PWA

CURRENT STATUS:
A starter React/Vite/PWA package has been uploaded. It already includes:
- local-first storage.js SSOT
- modular vehicle templates
- all-vehicle input form
- rules-led Compliance AI engine
- GraphHopper adapter placeholder
- driver trip planning dashboard
- Navigation PWA shell
- 3D map-style dashboard visual shell
- PWA manifest/service worker

MISSION:
Finish and harden this project without rewriting the working foundation.

CORE REQUIREMENTS:
1. Preserve storage.js as the Single Source of Truth.
2. Preserve modular vehicle input. The vehicle info page must only show legal/physical/routing-relevant fields for the selected vehicle type.
3. Do not create one huge confusing global vehicle form.
4. Keep Compliance AI advisory, explainable, and rules-led.
5. GraphHopper must remain an isolated provider adapter. Do not put routing API logic directly inside UI components.
6. Navigation PWA must support a full-screen 3D map dashboard with vehicle icon, route polyline, follow-camera behaviour, ETA, distance, turn instruction card, warning pins, reroute prompt, GPS confidence, offline status, route confidence, voice status, and stop navigation control.
7. Use Big V’s own branding and UI. Do not copy Google Maps branding, UI, icons, layout, or protected assets.
8. Navigation locks the active vehicle profile. Vehicle type and dimensions cannot be changed during active navigation.
9. Guidance is advisory only. Never claim legal route certainty.
10. Preserve working systems. Patch/extend only.

ALLOWED TO TOUCH:
- src/core/graphHopperAdapter.js
- src/core/complianceEngine.js
- src/config/vehicleTemplates.js
- src/pages/PlannerDashboard.jsx
- src/pages/NavigationPWA.jsx
- src/components/*
- src/styles/app.css
- public/manifest.webmanifest
- public/sw.js
- package.json only if required for map/routing package wiring

DO NOT TOUCH / DO NOT BREAK:
- Do not remove storage.js SSOT.
- Do not create duplicate state stores.
- Do not add hidden state inside random components.
- Do not remove safety disclaimer wording.
- Do not remove modular vehicle form logic.
- Do not rewrite the whole app.
- Do not add fleet/admin/Federation OS into this driver app unless explicitly requested.
- Do not add paid subscriptions yet.
- Do not guarantee legal compliance.

IMPLEMENTATION TARGETS:
- Wire real GraphHopper routing using safe API-key configuration.
- Add geocoding or coordinate input support safely.
- Render actual route polyline on map layer.
- Upgrade the 3D map shell to real MapLibre GL JS or Mapbox GL JS, depending on available key/config.
- Add route warning marker layer.
- Add offline/fallback status behaviour.
- Add route calculation error handling.
- Add data freshness warnings.
- Add clear empty/loading/error/success states.
- Add mobile-first responsive navigation UI.
- Keep map provider logic isolated from UI where possible.

STATE/DATA REQUIREMENTS:
- All app state must flow through storage.js.
- Vehicle profiles, trip plans, routes, navigation session, warning markers, compliance results, cached routes, and settings must remain in SSOT.
- Separate local state, route provider data, cached route data, compliance evidence, and navigation session state.
- Add safe schema extension only. Do not destructively rename existing state keys unless fully migrated.

VALIDATION GATES:
Before editing:
- Confirm project runs.
- Confirm storage.js loads.
- Confirm current dashboard renders.
- Confirm modular vehicle form changes fields by vehicle type.

After editing:
- npm run build must pass.
- No console-breaking runtime errors.
- Vehicle form must only show relevant fields.
- Compliance AI must flag missing legal-critical fields.
- GraphHopper errors must display human-readable messages.
- Navigation start must lock vehicle profile.
- Stop navigation must unlock vehicle profile.
- PWA manifest and service worker must remain valid.
- Mobile layout must remain usable.

STOP CONDITIONS:
Stop immediately and report if:
- Required source files are missing.
- storage.js architecture is incompatible.
- GraphHopper key/config is unavailable and live routing cannot be tested.
- A requested change would require copying proprietary Google Maps UI/branding/assets.
- A requested change would claim guaranteed legal compliance.

ROLLBACK GUIDANCE:
If routing/map wiring breaks the app, revert only the changed map/provider files and keep the starter dashboard, storage.js, modular vehicle templates, and Compliance AI intact.

FINAL CHECKLIST:
- Local-first SSOT preserved
- Modular all-vehicle input preserved
- GraphHopper isolated and safely wired
- Compliance AI advisory and explainable
- Navigation PWA 3D map dashboard working
- Vehicle profile locked during active navigation
- Offline/fallback status visible
- Safety disclaimer visible
- Build passes
- No feature creep added

Directive 1: Adapt the skill set to the task. Include full folder structure, program code, logic code, transition code, UI logic, UI code, and HTML/JSX where required. Preserve SSOT, prevent feature creep, and protect working systems.
```
