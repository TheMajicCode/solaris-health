# Solaris Holistic Health — LUCA Passport

A full-stack holistic health platform with a cinematic "Solaris Method" onboarding, a 360° **Health Passport**, an AI guide (**LUCA**), a curated care marketplace, and a sovereignty-first reward system. Built mobile-first with a dark, glassmorphic "Celestial Sanctuary" design system.

> **Tagline:** *Heal · Learn · Earn — Enter the Golden Age.*

---

## ✨ What's inside

### Three actor experiences
| Actor | Entry | Experience |
|-------|-------|------------|
| **Patient** | `sarah@solaris.health` / `demo123` | Cinematic onboarding → Solaris Method assessment → **Your Personal Sovereign Hub** (aka LUCA Passport) |
| **Practitioner** | `elena@solaris.health` / `demo123` | Practitioner Portal — practice profile onboarding, listing, booking requests |
| **Admin** | `admin@solaris.health` / `admin123` | Admin Console — platform stats, users, listing approvals, bookings |

Also seeded: `majd@luca.health` / `demo123` (patient).

### The Solaris Method (assessment & onboarding)
A guided questionnaire that scores:
- **4 Aspects of Being** — Physical, Mental, Emotional, Spiritual
- **8 Body Systems** — Bioelectrical, Hydration, Circadian, Microbiome, Respiratory, Neurological, Cardiovascular, Nutritional

…producing a **360° Vitality Score**, a radar profile, top focus areas, and LUCA-generated starter habits. Labs/photos can be uploaded during intake.

### Health Passport
A unified, **FHIR-aligned** view of every health signal — vitality, aspects, systems radar, documents, daily check-ins and a timeline. Designed so **a user's data can always be extracted** (sovereignty-ready; full FHIR export marked *TBD soon*).

### Rewards (LOVE points)
`account_created` +10 · `assessment_complete` +50 · `onboarding_complete` +25 · `daily_checkin` +5 · `booking_request` +30.

---

## 🧱 Tech stack
- **Frontend:** React 19 + Vite, state-based routing via `AppContext`, custom SVG charts (VitalityRing, RadarChart), Noto Serif + Inter, lucide-react icons.
- **Backend:** Node + Express, PostgreSQL (`pg`), JWT auth (`jsonwebtoken`), `bcryptjs`.
- **Design system:** CSS tokens in `src/index.css` (emerald `#4edea3`, gold `#ffb95f`, navy `#0c1322`).

---

## 🚀 Run locally

> **Note:** Any `localhost` URL below refers to **localhost of the machine you run these commands on** — not a hosted server.

### 1. Database
```bash
# PostgreSQL must be running. Create DB + user (defaults used by the app):
#   db: luca_passport, user: luca_user, password: luca_dev_2026, port 5432
psql -U postgres -c "CREATE USER luca_user WITH PASSWORD 'luca_dev_2026';"
psql -U postgres -c "CREATE DATABASE luca_passport OWNER luca_user;"

cd backend
psql "$DATABASE_URL" -f schema.sql          # base schema
psql "$DATABASE_URL" -f schema_solaris.sql   # Solaris extensions
node seed_solaris.js                         # demo data
```

### 2. Backend (port 5000)
```bash
cd backend
npm install
node src/server.js
```
Environment (`backend/.env`):
```
DATABASE_URL=postgresql://luca_user:luca_dev_2026@localhost:5432/luca_passport
JWT_SECRET=luca_dev_secret_2026_sovereign_health
PORT=5000
```

### 3. Frontend (port 3000)
```bash
npm install
npx vite
```
Open http://localhost:3000

---

## 🗂️ Project structure
```
backend/
  schema_solaris.sql        # Solaris tables (profiles, assessment, listings, rewards, …)
  seed_solaris.js           # demo users, Solaris Method template, practitioners, clinics
  src/
    routes/  auth users assessment listings journey luca practitioner admin
    lib/helpers.js          # reward award() + shapeUser()
    server.js
src/
  state/AppContext.jsx      # auth + app state, role-based routing
  flows/   Onboarding Auth Assessment
  pages/   Hub HealthPassport Luca Explore Profile Practitioner Admin
  components/  Shell ui (SolarisMark, VitalityRing, RadarChart, TBD, …)
  lib/api.js                # API client
  index.css                 # Solaris design system
```

---

## 🔌 API surface (selected)
- `POST /api/auth/register` · `POST /api/auth/login`
- `GET/PATCH /api/users/me` · `GET/PUT /api/users/profile`
- `GET /api/assessment/template` · `POST /api/assessment/submit` · `GET /api/assessment/latest|history`
- `GET /api/listings` (filters: type, q, featured) · `GET /api/listings/:id` · `POST /api/listings`
- `GET/POST /api/journey/{bookings,checkins,documents}` · `GET /api/journey/rewards`
- `GET/POST /api/luca/messages`
- `GET/PUT /api/practitioner/profile` · `GET /api/practitioner/bookings`
- `GET /api/admin/overview|users|listings|bookings` · `PATCH /api/admin/listings/:id`

---

## 🧭 Roadmap (marked **TBD soon** in-app)
Full FHIR export & data download · payments/payouts · scheduling & availability · practitioner records/care plans · content moderation · notifications/broadcasts · advanced consents. Auth is email-based in v1; the schema is kept extensible for future decentralized identity/payment rails.

---

*Solaris Holistic Health · MVP v1 · FHIR-aligned · Sovereignty-ready.*
