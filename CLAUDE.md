# CLAUDE.md

## Project

IHMS (Integrated HSE Management System) — a React SPA for managing contractor
HSE compliance on a project (personnel, anomalies, machinery, scaffolding,
BowTie risk assessments), with offline-first data sync and an optional
Android build via Capacitor.

## Commands

Package manager: **npm** (no lockfile committed; no yarn/pnpm files present).

```bash
npm install        # install dependencies
npm run dev         # start Vite dev server
npm run build        # production build -> dist/
npm run preview      # preview the production build locally
```

No test framework is configured (no test script in package.json, no
test/spec files in the repo). Don't assume Jest/Vitest exists.

Android (Capacitor), only needed when touching the mobile build:
```bash
npm run cap:add      # add the Android platform (one-time)
npm run cap:sync      # build web assets + sync into the Android project
npm run cap:open      # open the Android project in Android Studio
```
Actual APK builds run via `.github/workflows/build-android.yml`, not locally.

## Folder structure (top-level of `src/`)

- `App.jsx` / `main.jsx` — app root, role-based routing (Admin/Employer/Contractor), login
- `shared.js` — Supabase client helper (`sb`), THEME/style tokens, `usePersistedState`, multi-tenant company-context (`getCurrentCompanyId`/`setCurrentCompanyId`)
- `shared/` — cross-module UI (`DataView.jsx`: shared List/Grid table+card component)
- `offline/` — offline-first data layer: `offlineWrite.js` (write-through + local queue), `offlineDb.js` (IndexedDB cache), `syncEngine.js` (queue processor), `storageUpload.js` (Supabase Storage), `ArchiveManager.jsx`
- `personnel/`, `machinery/`, `scaffold/`, `bowtie/`, `jobpositions/`, `permissions/`, `dashboard/`, `superadmin/` — one folder per domain module
- `.github/workflows/` — Android APK build pipeline

## Conventions already in use

- **Module shape**: each domain folder has one `<name>Api.js` (data layer,
  camelCase exports) plus PascalCase `.jsx` components (e.g.
  `machinery/machineryApi.js` + `MachineryDashboard.jsx` + `MachineryForm.jsx`).
- **DB mapping**: every API file has a pair of mapper functions —
  `xFromRow(row)` (snake_case DB columns → camelCase JS object) and
  `xToDb(record)` (camelCase → snake_case) — keep this pattern for new tables.
- **No TypeScript** — plain `.js`/`.jsx` throughout.
- **No CSS files** — all styling is inline `style={{...}}` objects built from
  `THEME`/`styles` tokens exported by `shared.js`. Don't introduce a CSS
  framework or CSS modules without checking with the user first.
- **State**: plain `useState`/`useEffect`, no Redux/Zustand/Context-as-store.
  Cross-cutting concerns (auth/company context) are handled via small
  hooks/module-level functions in `shared.js`, not a global store.
- **Offline writes**: any new module that creates/updates records should go
  through `offlineWrite()` / `offlineWriteFile()` from `offline/offlineWrite.js`,
  not raw `sb()` calls, to get local-queue + retry behavior for free. New
  modules must be registered in `offline/syncEngine.js`'s module table map.
- **Multi-tenant scoping**: list/insert queries in company-scoped modules
  call `getCurrentCompanyId()` from `shared.js` and filter/tag rows by
  `company_id`. Not yet applied to every table — check the specific module
  before assuming it's scoped.
- **Language**: UI text and code comments are in Persian (Farsi), RTL layout.
  Match this in new code rather than switching to English.
- **Dates**: stored as ISO in the DB, always displayed as Jalali (Persian
  calendar) via helpers in `personnel/jalaliDate.jsx`.
- **Config/secrets**: Supabase URL and anon/publishable key are hardcoded in
  `shared.js` (no `.env` file in this project) — that's the existing pattern,
  not an oversight.
