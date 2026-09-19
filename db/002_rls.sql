-- ==============================================================================
-- Campus Connect: 002_rls.sql
-- Row Level Security (RLS) Policies
-- Enforces strict role-based access for students, drivers, admins, and public clients.
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. PROFILES POLICIES
-- Everyone can read profiles; users can update only their own profile without changing role.
-- ==============================================================================

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.get_my_role() = 'admin')
  WITH CHECK (
    -- Admins can update anything; regular users cannot change their role
    (public.get_my_role() = 'admin')
    OR
    (auth.uid() = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))
  );

-- ==============================================================================
-- 3. ROUTES, BUS_STOPS, BUSES POLICIES
-- Public read for active routes, stops, and buses; Admin full write.
-- ==============================================================================

-- Routes
DROP POLICY IF EXISTS "routes_select_public" ON public.routes;
CREATE POLICY "routes_select_public"
  ON public.routes
  FOR SELECT
  USING (is_active = true OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "routes_admin_all" ON public.routes;
CREATE POLICY "routes_admin_all"
  ON public.routes
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Bus Stops
DROP POLICY IF EXISTS "bus_stops_select_public" ON public.bus_stops;
CREATE POLICY "bus_stops_select_public"
  ON public.bus_stops
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "bus_stops_admin_all" ON public.bus_stops;
CREATE POLICY "bus_stops_admin_all"
  ON public.bus_stops
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Buses
DROP POLICY IF EXISTS "buses_select_public" ON public.buses;
CREATE POLICY "buses_select_public"
  ON public.buses
  FOR SELECT
  USING (is_active = true OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "buses_admin_all" ON public.buses;
CREATE POLICY "buses_admin_all"
  ON public.buses
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ==============================================================================
-- 4. DRIVER ASSIGNMENTS POLICIES
-- SELECT: own assignment or admin.
-- NO client INSERT/UPDATE (writes are handled strictly server-side via service role).
-- ==============================================================================

DROP POLICY IF EXISTS "driver_assignments_select" ON public.driver_assignments;
CREATE POLICY "driver_assignments_select"
  ON public.driver_assignments
  FOR SELECT
  USING (driver_id = auth.uid() OR public.get_my_role() = 'admin');

-- ==============================================================================
-- 5. BUS LOCATIONS POLICIES
-- Public SELECT. NO client INSERT/UPDATE/DELETE (writes handled by server service-role).
-- ==============================================================================

DROP POLICY IF EXISTS "bus_locations_select_public" ON public.bus_locations;
CREATE POLICY "bus_locations_select_public"
  ON public.bus_locations
  FOR SELECT
  USING (true);

-- ==============================================================================
-- 6. COMPLAINTS POLICIES
-- SELECT: Own complaints or Admin.
-- INSERT: Students can insert their own complaints with status='open'.
-- UPDATE: Admin only.
-- ==============================================================================

DROP POLICY IF EXISTS "complaints_select" ON public.complaints;
CREATE POLICY "complaints_select"
  ON public.complaints
  FOR SELECT
  USING (student_id = auth.uid() OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "complaints_insert_own" ON public.complaints;
CREATE POLICY "complaints_insert_own"
  ON public.complaints
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    AND status = 'open'
  );

DROP POLICY IF EXISTS "complaints_update_admin" ON public.complaints;
CREATE POLICY "complaints_update_admin"
  ON public.complaints
  FOR UPDATE
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ==============================================================================
-- 7. ALERTS POLICIES
-- Public read for all alerts; Admin write only.
-- ==============================================================================

DROP POLICY IF EXISTS "alerts_select_public" ON public.alerts;
CREATE POLICY "alerts_select_public"
  ON public.alerts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "alerts_admin_all" ON public.alerts;
CREATE POLICY "alerts_admin_all"
  ON public.alerts
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');
