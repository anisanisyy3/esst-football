# ESST Football Tournament — Website

A complete, working football (soccer) tournament website for ESST: public pages
(matches, live scores, league standings, teams, statistics) in **French, English
and Arabic (RTL)**, plus a secure **organizer dashboard** with multiple score
managers, powered by **Supabase** (PostgreSQL + Auth + Row Level Security +
Realtime).

Built with vanilla JavaScript + Vite. No React, no paid services.

---

## Table of contents

1. [What you need first](#1-what-you-need-first)
2. [Run the project](#2-run-the-project)
3. [Open without installing anything (portable version)](#3-open-without-installing-anything-portable-version)
4. [Demo mode (no Supabase yet)](#4-demo-mode-no-supabase-yet)
5. [Connect your Supabase project](#5-connect-your-supabase-project)
6. [Create the first super administrator](#6-create-the-first-super-administrator)
7. [Invite score managers](#7-invite-score-managers)
8. [Enable realtime updates](#8-enable-realtime-updates)
9. [Publish on Netlify](#9-publish-on-netlify)
10. [Project structure](#10-project-structure)
11. [Tests](#11-tests)
12. [Troubleshooting](#12-troubleshooting)\n13. [New features (player accounts, teams, lineups, reports, OVR)](#13-new-features-player-accounts-teams-lineups-reports-ovr)

---

## 1. What you need first

### Install Node.js (Windows)

1. Download the **LTS** installer from <https://nodejs.org> (version 20 or newer).
2. Run the installer with the default options.
3. Verify: open **PowerShell** and type:

```powershell
node -v
```

You should see something like `v22.x.x`. If you see an error, restart PowerShell.

> Note: if PowerShell complains "running scripts is disabled" when running
> `npm`, use `npm.cmd` instead of `npm` (same commands: `npm.cmd install`, …),
> or run: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Open the project

```powershell
cd "C:\Users\PC\Documents\Default Project"
code .        # opens Visual Studio Code (optional)
```

## 2. Run the project

```powershell
npm install        # first time only (downloads dependencies)
npm run dev        # starts the development website
```

Open the printed URL — usually **http://localhost:5173**.

Other commands:

```powershell
npm run build           # production build into the dist/ folder
npm run build:standalone # portable build into the esst-website/ folder (see section 3)
npm run preview         # serves the production build on http://localhost:4173
npm test                # unit tests: standings calculation, validation, i18n coverage
```

## 3. Open without installing anything (portable version)

You can also get the website as a **plain folder you can open by
double-clicking** — no Node.js, no command line, no internet needed:

```powershell
npm run build:standalone
```

This creates the **`esst-website/`** folder. Inside it, double-click
**`index.html`**: the site opens straight from the disk in your browser and
runs in demo mode (sample data stored only in that browser).

- It is a **single self-contained file** (~362 KB): all CSS and JavaScript are
  inlined, so nothing needs to be fetched.
- Navigation uses `#hash` links in this version (for example
  `index.html#/standings`) because browsers do not allow normal page routing
  from a local file. Everything else — language switch, RTL Arabic, the demo
  dashboard — works exactly like the hosted version.
- You can copy this folder to a USB key, send it by email or put it on any
  web space. Add `?portable=1` to the address to force the same `#hash`
  navigation when hosting the single file somewhere without SPA fallbacks.
- Re-run the command whenever the site code changes; the folder is rebuilt
  from scratch.

## 4. Demo mode (no Supabase yet)

If the `.env` file is missing or empty, the website runs in **DEMO MODE**:

- An orange "MODE DÉMO" banner is always visible.
- Sample teams/matches are stored **only in your browser** (localStorage).
- Changes made in the dashboard stay local; nothing is published or synced.
- The login page offers demo role buttons (super admin / score manager) so you
  can explore the dashboard — this is clearly labeled and is **not** real
  authentication.
- "Réinitialiser" in the demo banner resets the sample data.

Everything works exactly the same once real credentials are added — no code
changes needed.

## 5. Connect your Supabase project

### 5.1 Create the project

1. Sign up at <https://supabase.com> (free plan is enough) and create a project.
2. Wait until the database is provisioned.

### 5.2 Run the SQL migrations

1. In the Supabase dashboard open **SQL Editor** → **New query**.
2. Copy the **whole content** of `supabase/migrations/0001_init.sql`, paste it, press **Run**.
3. New query → paste the whole content of `supabase/migrations/0002_realtime.sql` → **Run**.
4. New query → paste the whole content of `supabase/seed.sql` → **Run** (creates the settings row).

If a step says "success", it worked.

### 5.3 Put the credentials in the project

1. In Supabase open **Project Settings → API**.
2. Copy the **Project URL** and the **Publishable key** (the older "anon public"
   key also works — both are safe for browsers; **never** use the `service_role`
   or secret key here).
3. Create a file named exactly `.env` in the project root (next to
   `package.json`), or copy `.env.example`:

```powershell
copy .env.example .env
```

Then fill it:

```ini
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
```

4. Restart `npm run dev` (env files are only read at startup). The demo banner
   disappears — you are now on the real database. The site starts empty:
   create your teams and matches from the dashboard.

> **If Supabase is configured but unreachable** (bad URL, project paused), the
> pages show a clear error message — the app never silently falls back to demo
> mode.

## 6. Create the first super administrator

There is **no public registration**. The first organizer is created manually:

1. Supabase dashboard → **Authentication → Users → Add user**:
   - enter your email + a password,
   - tick **Auto Confirm User**,
   - press **Create user**.
   A profile row is created automatically with the `pending` role.

2. Promote yourself **once** with this documented SQL command in the SQL Editor
   (replace the email):

```sql
update public.profiles
set role = 'super_admin'
where email = 'your.email@example.com';
```

3. Sign in on the website (`/admin/login`) with that email and password.
   You now have full tournament management.

## 7. Invite score managers

For every additional organizer:

1. Supabase dashboard → **Authentication → Users → Add user** (email + password,
   auto-confirm). The account appears as **pending** and has **no permissions**.
2. Sign in as a **super administrator** → Dashboard → **Gestionnaires**.
3. Press **"Promouvoir en gestionnaire"** next to the pending account.
   The role change goes through the secure database function
   `change_manager_role()`, which only super admins can call.
4. "Révoquer" puts a manager back to pending (access removed). You can never
   remove your **own** role, and the **last super admin** cannot be demoted.

## 8. Enable realtime updates

Migration `0002_realtime.sql` already adds the `matches` table to the
`supabase_realtime` publication. To double-check in the dashboard:

- **Database → Publications → supabase_realtime** → the `matches` table should
  be listed (with "Insert/Update/Delete" enabled).

Test: open the public **Matches** page in two browser windows, update a score
from the dashboard in one window — the other updates automatically within a
second, including the standings.

## 9. Publish on Netlify

1. Push the project to GitHub (the `.env` file is already ignored by
   `.gitignore` — never commit it).
2. On <https://netlify.com> → **Add new site → Import an existing project** →
   pick your repository.
3. Netlify reads `netlify.toml` automatically:
   - build command: `npm run build`
   - publish folder: `dist`
   - SPA redirect so `/matches`, `/admin`, … never 404 on refresh.
4. Add your two environment variables in **Site configuration → Environment
   variables**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Deploy. Add your Supabase site URL to **Authentication → URL Configuration →
   Site URL** so login redirects work.

Quick alternative without Git: run `npm run build` locally and drag the
`dist` folder onto Netlify's "Deploy manually" page (remember the env vars
still need to be set — use the Git method for a real deployment).

## 9b. Publish on Railway

1. Push the project to GitHub (the `.env` file is already ignored by
   `.gitignore` — never commit it).
2. On <https://railway.app> → **New Project → Deploy from GitHub repo** →
   pick your repository.
3. Railway reads `railway.toml` automatically:
   - build command: `npm run build` (output: `dist/`)
   - start command: `npm start` (serves `dist/` with SPA fallback on `$PORT`)
4. In the service → **Variables**, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` (same values as in `.env`).
   - If both are left empty, the site runs in clearly-labeled DEMO MODE.
5. Deploy. Add your Railway URL to **Supabase → Authentication → URL
   Configuration → Site URL** so login redirects work.

The included `server.mjs` is a zero-dependency static file server with
SPA fallback, so `/matches`, `/admin`, … never 404 on refresh.

## 10. Project structure

```
├── index.html                  # single page shell
├── package.json / vite.config.js / netlify.toml
├── .env.example                # template for your Supabase credentials
├── public/assets/favicon.svg
├── src/
│   ├── main.js                 # entry: language, header/footer, router, auth
│   ├── router.js               # clean browser routes (refresh-safe)
│   ├── styles/                 # main.css, responsive.css, rtl.css
│   ├── lib/
│   │   ├── supabaseClient.js   # client + demo-mode switch
│   │   └── settingsCache.js    # tournament settings cache
│   ├── services/
│   │   ├── dataService.js      # one facade: Supabase OR demo
│   │   ├── authService.js      # sessions + profiles/roles
│   │   └── demoService.js      # labeled local demo data
│   ├── i18n/
│   │   ├── translations.js     # ALL strings (FR default / EN / AR)
│   │   └── language.js         # localStorage + RTL handling + t()
│   ├── components/             # header, footer, matchCard, standingsTable,
│   │   ...                     # teamCard, logo, admin match/team managers
│   ├── pages/                  # home, matches, matchDetails, standings,
│   │   ...                     # teams, teamDetails, statistics, adminLogin,
│   │                           # adminDashboard
│   └── utils/                  # standings (calculateStandings), validation,
│                               # stats, dateFormat, dom helpers
├── supabase/
│   ├── migrations/0001_init.sql     # tables + triggers + functions + RLS
│   ├── migrations/0002_realtime.sql # realtime publication
│   ├── seed.sql                     # settings row
│   └── tests/rls-checklist.md       # security test checklist
└── scripts/
    ├── test-standings.mjs      # unit tests (npm test)
    └── check-i18n.mjs          # every used key exists in FR/EN/AR
```

## 11. Tests

```powershell
npm test
```

Runs 44 assertions on the league engine (win/draw/loss, goal-difference and
goals-scored tiebreaks, alphabetical tiebreak, teams without matches, statuses
that must not count, `finished → postponed` recalculation, invalid scores,
match/team validation, statistics) plus an i18n coverage check (194 keys × 3
languages).

Database security tests (anonymous / pending / manager / super admin,
self-promotion, last-super-admin protection) are documented step by step in
[`supabase/tests/rls-checklist.md`](supabase/tests/rls-checklist.md).

## 13. New features (player accounts, teams, lineups, reports, OVR)

This upgraded build adds:

- **Public member registration** at `/register` (no invite code). Mandatory football
  profile (full name, birth year, position, preferred foot) before member features.
- **Member-only profiles & career stats** at `/players` and `/players/:id`
  (goals, assists, cards, minutes, clean sheets, OVR history).
- **Team space** at `/my-team`: roster, private posts, join requests (captain).
- **Team flows**: create-team requests, join requests, transfers — all approved by
  captains / Super Admin. Max 45 active players per team (enforced in DB).
- **Captain-only lineup editor** (pitch) with formation, 11 starters, up to 7 subs,
  jersey numbers, captain/vice. Private before kickoff.
- **Match report workspace** (admin → Reports): mark a match LIVE (publishes
  lineups), then enter the post-match event report. Score is derived from goal
  events; standings, stats, OVR and suspensions update automatically.
- **Automatic OVR** (start 60, clamp 50–99) per the official rules in
  `src/utils/ovr.js`, with per-match ledger and deterministic recompute on
  correction.
- **Red-card suspensions** (one match) enforced in lineup validation.

### Supabase setup additions

1. Run `supabase/migrations/0001_init.sql` then `supabase/migrations/0003_players.sql`.
2. Create Storage buckets `profile-photos` (public read) and `team-logos` (public read).
3. First Super Admin: create an Auth user, then run in SQL Editor:
   `select public.bootstrap_super_admin('<user-uuid>');`
   (only works while no super admin exists).
4. Approve Score Managers via the admin dashboard (Managers section) or
   `select public.change_manager_role('<uuid>', 'score_manager');`.

### Security tests you can run after configuring Supabase

See `supabase/tests/rls-checklist.md` (create it) for the manual RLS checks:
anonymous read of private profiles denied, cross-team lineup privacy, 45-cap
concurrency, last-super-admin protection, etc. These cannot be run without
live credentials and are documented rather than automated.

## 12. Troubleshooting

| Problem | Solution |
|---|---|
| `npm` is not recognized | Install Node.js (see section 1) or use `npm.cmd` |
| "running scripts is disabled" | Use `npm.cmd …` or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Site stays in demo mode | Both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` must be filled, then restart `npm run dev` |
| "Could not reach the database" | Check the URL/key, make sure the Supabase project is not paused, run the migrations |
| Login fails for a fresh account | Tick **Auto Confirm User** when adding the user; accounts created via magic link must confirm their email first |
| Profile error after login | Run the migrations (`0001_init.sql` creates profiles automatically) |
| 404 when refreshing `/matches` online | The SPA redirect in `netlify.toml` must be deployed (Netlify does it automatically) |
| No realtime updates | Re-run `0002_realtime.sql` and check the publication in Database → Publications |
| Change points rule (e.g. win = 2) | Dashboard → Settings — the standings recalculate everywhere automatically |

---

**Security reminders**

- Only the publishable/anon key ever lives in browser code.
- The `service_role` key must never be added to this project or committed.
- `.env` is git-ignored; use `.env.example` as the template.
- All permissions are enforced by **Row Level Security policies** + security
  definer functions, not by the interface alone.
