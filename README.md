# Campus Connect — University Shuttle Tracking App

**Campus Connect** is a complete, full-stack, mobile-first university shuttle tracking system. It combines real-time bus location telemetry sourced directly from the **driver's smartphone** (no dedicated GPS hardware needed), interactive Leaflet campus maps, service alerts, and a student grievance ticketing system.

---

## Architecture Overview

- **Frontend (`client/`)**: React 18, Vite, React Router v6, Leaflet & React-Leaflet, Supabase Client, Lucide icons.
- **Backend (`server/`)**: Node.js (Express ESM), Helmet, CORS, Supabase Admin (Service Role SDK).
- **Database (`db/`)**: PostgreSQL with PostGIS, Supabase Auth, Row Level Security (RLS) policies, and Supabase Realtime pub/sub replication.
- **Hardware-Free GPS**: Employs the HTML5 Geolocation API (`watchPosition`) and Screen Wake Lock API running in the driver's mobile browser.

---

## Directory Structure

```text
campus-connect/
├── README.md
├── .gitignore
├── db/
│   ├── 001_schema.sql         # PostGIS, tables, constraints, trigger & get_my_role()
│   ├── 002_rls.sql            # Strict Row Level Security policies
│   └── 003_seed.sql           # Campus routes, geocoded stops, fleet buses & mock points
├── server/                    # Express API (ESM)
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── index.js           # Server entry, helmet, 32kb json, CORS, health & 404
│       ├── lib/supabaseAdmin.js # Service-role client
│       ├── middleware/auth.js # requireAuth & requireRole middleware
│       ├── utils/validate.js  # Validation routines (isRegNo, isCoord, isUuid, etc.)
│       └── routes/
│           ├── tracking.js    # Active fleet, start/stop session, driver GPS push
│           ├── complaints.js  # Student complaint submission & admin resolution
│           ├── alerts.js      # Campus service alerts
│           └── profile.js     # User profiles & student registration numbers
└── client/                    # React 18 + Vite
    ├── .env.example
    ├── package.json
    ├── vite.config.js         # Mobile LAN host enabled
    ├── index.html             # Mobile viewport-fit=cover
    └── src/
        ├── main.jsx           # App mounting & Leaflet styles
        ├── App.jsx            # Routes & Protected role-based guards
        ├── context/AuthContext.jsx # Session & profile state synchronization
        ├── hooks/useBusLocations.js # REST initial fetch + Supabase Realtime + Mock fallback
        ├── lib/supabaseClient.js    # Supabase browser client
        ├── lib/mockTracker.js       # Waypoint movement engine for demo/mock mode
        ├── components/
        │   ├── MapView.jsx          # Leaflet map, custom SVG DivIcons, route polylines
        │   ├── BusCard.jsx          # Fleet card with LIVE / MOCK / OFFLINE badges
        │   ├── Badge.jsx, Loader.jsx, ErrorState.jsx, EmptyState.jsx
        │   ├── Layout.jsx           # App shell with topbar & role badge
        │   └── BottomNav.jsx        # Role-based navigation tabs
        ├── styles/global.css        # Mobile-first CSS design system (--blue: #2563eb)
        └── pages/
            ├── Login.jsx, Register.jsx, Alerts.jsx
            ├── student/
            │   ├── StudentHome.jsx  # Interactive map + bus drawer + stops
            │   ├── Complaints.jsx   # List student's own complaints
            │   ├── NewComplaint.jsx # Submit grievance with validation
            │   └── Profile.jsx      # View/edit student profile & registration number
            ├── driver/
            │   └── DriverDashboard.jsx # Driver smartphone tracking cockpit
            └── admin/
                ├── AdminDashboard.jsx  # Fleet metrics & active buses
                └── ComplaintsAdmin.jsx # Triage complaints & write admin notes
```

---

## 1. Supabase Setup

1. Create a project on [Supabase](https://supabase.com).
2. Open the **SQL Editor** in your Supabase project dashboard.
3. Execute the SQL files in order:
   - Run `db/001_schema.sql` (Creates extensions, schema tables, functions, and user trigger).
   - Run `db/002_rls.sql` (Enables and configures RLS on all 8 tables).
   - Run `db/003_seed.sql` (Populates Delhi campus routes, stops, buses, and initial location).
4. **Enable Email Authentication**:
   - Go to **Authentication -> Providers -> Email**.
   - Make sure **Enable Email provider** is turned on.
   - (Optional for development) Toggle OFF *Confirm email* for immediate testing.
5. **Enable Realtime on `bus_locations`**:
   - Go to **Database -> Replication** (or execute the following SQL statement in the SQL Editor):
     ```sql
     ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_locations;
     ```

---

## 2. Server Setup

1. Open your terminal and navigate to `server/`:
   ```bash
   cd campus-connect/server
   ```
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Configure your `.env` variables:
   ```env
   PORT=4000
   SUPABASE_URL=https://<your-project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-secret-key>
   CORS_ORIGIN=http://localhost:5173
   ```
   > **Note**: Obtain `SUPABASE_SERVICE_ROLE_KEY` from Supabase Dashboard -> **Settings -> API -> Project API Keys -> service_role (secret)**.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run the server:
   ```bash
   npm run dev
   ```
   The API will start at `http://localhost:4000`. Verify with `http://localhost:4000/health`.

---

## 3. Client Setup

1. Open a new terminal and navigate to `client/`:
   ```bash
   cd campus-connect/client
   ```
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Configure your `.env` variables:
   ```env
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
   VITE_API_BASE=http://localhost:4000
   VITE_MOCK_TRACKING=true
   ```
   > **Note**: `VITE_MOCK_TRACKING=true` enables realistic waypoint movement for demonstration before field tests.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the frontend development server:
   ```bash
   npm run dev
   ```
   The web app will open at `http://localhost:5173`.

---

## 4. How to Promote the First Admin

After registering an account in the UI (e.g. `admin@university.edu`), execute this in the Supabase SQL editor to grant full administrator privileges:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@university.edu'
);
```

Once promoted, log in as `admin@university.edu` to access the Admin Dashboard, fleet health monitors, alert dispatcher, and complaint triage system.

---

## 5. How to Test as Driver on a Smartphone

The driver tracking cockpit uses the phone's native GPS and screen wake lock:

1. Ensure the development server is running with `host: true` (already configured in `vite.config.js`).
2. Find your laptop's Local IP address:
   - Windows: `ipconfig` (e.g., `192.168.1.15`)
   - macOS / Linux: `ifconfig`
3. **Important — Geolocation Security Policy**:
   Modern mobile browsers (Chrome / Safari) require **HTTPS** or `localhost` to allow the HTML5 Geolocation API and Screen Wake Lock API.
   - **Option A (Recommended — Ngrok)**:
     Tunnel port 5173 with HTTPS:
     ```bash
     npx ngrok http 5173
     ```
     Open the provided `https://xxxx.ngrok-free.app` URL on your phone browser.
   - **Option B (Chrome Flag for Local IP)**:
     On Android Chrome, navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, enter `http://192.168.1.15:5173`, enable it, and relaunch Chrome.
4. Sign in with a driver account (or register selecting the "Driver" role).
5. Open `/driver`, choose your shuttle bus from the dropdown, and tap **"Start Sending My Location"**.
6. The app will:
   - Acquire a wake lock to keep the phone screen lit while driving.
   - Stream GPS coordinates every 5 seconds to the backend.
   - Automatically buffer pings in an offline queue if driving through cell reception dead zones.

---

## 6. Security Notes

- **Never Expose `SUPABASE_SERVICE_ROLE_KEY`**: This key bypasses PostgreSQL Row Level Security (RLS). It must remain exclusively in `server/.env`.
- **Driver GPS Authentication**: Location fixes are only accepted if the authenticated driver has an active driving assignment matching that bus.
- **Client Sanitization**: All user inputs (complaints, alerts, registration numbers) are strictly validated on both client and server before database write operations.
- **Turn Off Mock Mode in Production**: Set `VITE_MOCK_TRACKING=false` in production environments so only authentic live driver telemetry is broadcast.

---

## 7. Pre-Production Verification Checklist

- [ ] Run `npm run build` in `client/` to verify zero bundling or syntax issues.
- [ ] Verify `GET /health` on Express returns `{ "status": "ok" }`.
- [ ] Ensure Supabase Realtime publication includes `bus_locations`.
- [ ] Confirm RLS is enabled on all 8 tables in `db/002_rls.sql`.
- [ ] Test Geolocation watch & Wake Lock on mobile device over HTTPS.
- [ ] Submit a test complaint as a student and confirm the admin can view and update its resolution status.
