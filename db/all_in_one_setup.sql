-- ==============================================================================
-- Campus Connect: All-in-One Database Setup
-- Copy and paste this ENTIRE file into the Supabase SQL Editor and click "Run".
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SCHEMA TABLES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'driver', 'admin')),
  registration_no TEXT UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#2563eb',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bus_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL CHECK (lat >= -90.0 AND lat <= 90.0),
  lng DOUBLE PRECISION NOT NULL CHECK (lng >= -180.0 AND lng <= 180.0),
  seq INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_route_stop_seq UNIQUE (route_id, seq)
);

CREATE TABLE IF NOT EXISTS public.buses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_no TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 40 CHECK (capacity > 0),
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_bus_assignment
  ON public.driver_assignments (bus_id)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS public.bus_locations (
  bus_id UUID PRIMARY KEY REFERENCES public.buses(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL CHECK (lat >= -90.0 AND lat <= 90.0),
  lng DOUBLE PRECISION NOT NULL CHECK (lng >= -180.0 AND lng <= 180.0),
  speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 0,
  heading DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_mock BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('bus', 'driver', 'route', 'app', 'other')),
  subject TEXT NOT NULL CHECK (char_length(subject) >= 3 AND char_length(subject) <= 120),
  body TEXT NOT NULL CHECK (char_length(body) >= 10 AND char_length(body) <= 2000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) >= 3),
  body TEXT NOT NULL CHECK (char_length(body) >= 5),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. HELPER FUNCTIONS & TRIGGERS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $fn$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$fn$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone, registration_no)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    COALESCE(new.raw_user_meta_data->>'phone', NULL),
    COALESCE(new.raw_user_meta_data->>'registration_no', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    registration_no = COALESCE(public.profiles.registration_no, EXCLUDED.registration_no);
  RETURN new;
END;
$fn$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.get_my_role() = 'admin')
  WITH CHECK (
    (public.get_my_role() = 'admin')
    OR
    (auth.uid() = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))
  );

-- Routes, Stops, Buses Policies
DROP POLICY IF EXISTS "routes_select_public" ON public.routes;
CREATE POLICY "routes_select_public" ON public.routes FOR SELECT USING (is_active = true OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "routes_admin_all" ON public.routes;
CREATE POLICY "routes_admin_all" ON public.routes FOR ALL USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "bus_stops_select_public" ON public.bus_stops;
CREATE POLICY "bus_stops_select_public" ON public.bus_stops FOR SELECT USING (true);

DROP POLICY IF EXISTS "bus_stops_admin_all" ON public.bus_stops;
CREATE POLICY "bus_stops_admin_all" ON public.bus_stops FOR ALL USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "buses_select_public" ON public.buses;
CREATE POLICY "buses_select_public" ON public.buses FOR SELECT USING (is_active = true OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "buses_admin_all" ON public.buses;
CREATE POLICY "buses_admin_all" ON public.buses FOR ALL USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- Driver Assignments Policies
DROP POLICY IF EXISTS "driver_assignments_select" ON public.driver_assignments;
CREATE POLICY "driver_assignments_select" ON public.driver_assignments FOR SELECT USING (driver_id = auth.uid() OR public.get_my_role() = 'admin');

-- Bus Locations Policies
DROP POLICY IF EXISTS "bus_locations_select_public" ON public.bus_locations;
CREATE POLICY "bus_locations_select_public" ON public.bus_locations FOR SELECT USING (true);

-- Complaints Policies
DROP POLICY IF EXISTS "complaints_select" ON public.complaints;
CREATE POLICY "complaints_select" ON public.complaints FOR SELECT USING (student_id = auth.uid() OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "complaints_insert_own" ON public.complaints;
CREATE POLICY "complaints_insert_own" ON public.complaints FOR INSERT WITH CHECK (auth.uid() = student_id AND status = 'open');

DROP POLICY IF EXISTS "complaints_update_admin" ON public.complaints;
CREATE POLICY "complaints_update_admin" ON public.complaints FOR UPDATE USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- Alerts Policies
DROP POLICY IF EXISTS "alerts_select_public" ON public.alerts;
CREATE POLICY "alerts_select_public" ON public.alerts FOR SELECT USING (true);

DROP POLICY IF EXISTS "alerts_admin_all" ON public.alerts;
CREATE POLICY "alerts_admin_all" ON public.alerts FOR ALL USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- 5. REALTIME REPLICATION
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_locations;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN undefined_object THEN
    NULL;
END $$;

-- 6. SEED DATA
DO $$
DECLARE
  v_route_north_id UUID := '11111111-1111-4111-a111-111111111111'::UUID;
  v_route_hostel_id UUID := '22222222-2222-4222-a222-222222222222'::UUID;
  v_bus_1_id UUID := '33333333-3333-4333-a333-333333333333'::UUID;
  v_bus_2_id UUID := '44444444-4444-4444-a444-444444444444'::UUID;
BEGIN
  -- Routes
  INSERT INTO public.routes (id, name, color, is_active)
  VALUES 
    (v_route_north_id, 'North Loop', '#2563eb', true),
    (v_route_hostel_id, 'Hostel Line', '#10b981', true)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    color = EXCLUDED.color,
    is_active = EXCLUDED.is_active;

  -- Stops for North Loop
  INSERT INTO public.bus_stops (route_id, name, lat, lng, seq)
  VALUES 
    (v_route_north_id, 'Campus Main Gate', 28.6139, 77.2090, 1),
    (v_route_north_id, 'Science & Tech Block', 28.6185, 77.2145, 2),
    (v_route_north_id, 'Central Library & Arts', 28.6240, 77.2210, 3)
  ON CONFLICT (route_id, seq) DO UPDATE SET
    name = EXCLUDED.name,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng;

  -- Stops for Hostel Line
  INSERT INTO public.bus_stops (route_id, name, lat, lng, seq)
  VALUES 
    (v_route_hostel_id, 'Hostel Complex East', 28.6080, 77.2020, 1),
    (v_route_hostel_id, 'Sports Complex Arena', 28.6110, 77.2060, 2)
  ON CONFLICT (route_id, seq) DO UPDATE SET
    name = EXCLUDED.name,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng;

  -- Buses
  INSERT INTO public.buses (id, plate_no, capacity, route_id, is_active)
  VALUES
    (v_bus_1_id, 'DL-01-CC-1001', 40, v_route_north_id, true),
    (v_bus_2_id, 'DL-01-CC-1002', 35, v_route_hostel_id, true)
  ON CONFLICT (plate_no) DO UPDATE SET
    capacity = EXCLUDED.capacity,
    route_id = EXCLUDED.route_id,
    is_active = EXCLUDED.is_active;

  -- Seed bus location
  INSERT INTO public.bus_locations (bus_id, lat, lng, speed_kmh, heading, is_mock, updated_at)
  VALUES (v_bus_1_id, 28.6139, 77.2090, 24.5, 45.0, true, now())
  ON CONFLICT (bus_id) DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    speed_kmh = EXCLUDED.speed_kmh,
    heading = EXCLUDED.heading,
    is_mock = EXCLUDED.is_mock,
    updated_at = now();

  -- Initial System Alert
  INSERT INTO public.alerts (id, title, body, severity, route_id, created_at)
  VALUES (
    '55555555-5555-4555-a555-555555555555'::UUID,
    'Welcome to Campus Connect Shuttle Tracker',
    'Live driver tracking is active across campus routes. Watch buses in real-time or simulate routes using mock mode.',
    'info',
    v_route_north_id,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

-- 7. SEED SAMPLE USERS FOR TESTING
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001'::UUID;
  v_driver_id UUID := 'b0000000-0000-0000-0000-000000000002'::UUID;
  v_student_id UUID := 'c0000000-0000-0000-0000-000000000003'::UUID;
BEGIN
  -- Clean up prior sample users if they exist
  DELETE FROM auth.users WHERE email IN ('admin@campus.edu', 'driver@campus.edu', 'student@campus.edu');

  -- 1. Insert Administrator (admin@campus.edu / admin123)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES (
    v_admin_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    'authenticated',
    'authenticated',
    'admin@campus.edu',
    crypt('admin123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Dr. Sarah Connor (Admin)","role":"admin"}'::jsonb,
    now(),
    now()
  );

  INSERT INTO public.profiles (id, full_name, role, phone)
  VALUES (v_admin_id, 'Dr. Sarah Connor (Admin)', 'admin', '+91 98765 99999')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = EXCLUDED.full_name;

  -- 2. Insert Bus Driver (driver@campus.edu / driver123)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES (
    v_driver_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    'authenticated',
    'authenticated',
    'driver@campus.edu',
    crypt('driver123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Rajesh Kumar (Driver)","role":"driver"}'::jsonb,
    now(),
    now()
  );

  INSERT INTO public.profiles (id, full_name, role, phone)
  VALUES (v_driver_id, 'Rajesh Kumar (Driver)', 'driver', '+91 98765 12345')
  ON CONFLICT (id) DO UPDATE SET role = 'driver', full_name = EXCLUDED.full_name;

  -- 3. Insert Student (student@campus.edu / student123)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES (
    v_student_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    'authenticated',
    'authenticated',
    'student@campus.edu',
    crypt('student123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Alex Johnson (Student)","role":"student","registration_no":"CS202401"}'::jsonb,
    now(),
    now()
  );

  INSERT INTO public.profiles (id, full_name, role, registration_no, phone)
  VALUES (v_student_id, 'Alex Johnson (Student)', 'student', 'CS202401', '+91 98765 43210')
  ON CONFLICT (id) DO UPDATE SET role = 'student', full_name = EXCLUDED.full_name;

END $$;
