-- ==============================================================================
-- Campus Connect: 003_seed.sql
-- Initial Seed Data: Campus Routes, Geocoded Delhi Stops, Fleet Buses, and Mock Locations
-- ==============================================================================

DO $$
DECLARE
  v_route_north_id UUID := '11111111-1111-4111-a111-111111111111'::UUID;
  v_route_hostel_id UUID := '22222222-2222-4222-a222-222222222222'::UUID;
  v_bus_1_id UUID := '33333333-3333-4333-a333-333333333333'::UUID;
  v_bus_2_id UUID := '44444444-4444-4444-a444-444444444444'::UUID;
BEGIN
  -- 1. Insert Routes
  INSERT INTO public.routes (id, name, color, is_active)
  VALUES 
    (v_route_north_id, 'North Loop', '#2563eb', true),
    (v_route_hostel_id, 'Hostel Line', '#10b981', true)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    color = EXCLUDED.color,
    is_active = EXCLUDED.is_active;

  -- 2. Insert Bus Stops for North Loop (Delhi Coordinates)
  -- Stop 1: Campus Main Gate (28.6139, 77.2090)
  INSERT INTO public.bus_stops (route_id, name, lat, lng, seq)
  VALUES (v_route_north_id, 'Campus Main Gate', 28.6139, 77.2090, 1)
  ON CONFLICT (route_id, seq) DO UPDATE SET
    name = EXCLUDED.name,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng;

  -- Stop 2: Science & Tech Block (28.6185, 77.2145)
  INSERT INTO public.bus_stops (route_id, name, lat, lng, seq)
  VALUES (v_route_north_id, 'Science & Tech Block', 28.6185, 77.2145, 2)
  ON CONFLICT (route_id, seq) DO UPDATE SET
    name = EXCLUDED.name,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng;

  -- Stop 3: Central Library & Arts (28.6240, 77.2210)
  INSERT INTO public.bus_stops (route_id, name, lat, lng, seq)
  VALUES (v_route_north_id, 'Central Library & Arts', 28.6240, 77.2210, 3)
  ON CONFLICT (route_id, seq) DO UPDATE SET
    name = EXCLUDED.name,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng;

  -- Stops for Hostel Line
  INSERT INTO public.bus_stops (route_id, name, lat, lng, seq)
  VALUES (v_route_hostel_id, 'Hostel Complex East', 28.6080, 77.2020, 1)
  ON CONFLICT (route_id, seq) DO UPDATE SET
    name = EXCLUDED.name,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng;

  INSERT INTO public.bus_stops (route_id, name, lat, lng, seq)
  VALUES (v_route_hostel_id, 'Sports Complex Arena', 28.6110, 77.2060, 2)
  ON CONFLICT (route_id, seq) DO UPDATE SET
    name = EXCLUDED.name,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng;

  -- 3. Insert Buses
  INSERT INTO public.buses (id, plate_no, capacity, route_id, is_active)
  VALUES
    (v_bus_1_id, 'DL-01-CC-1001', 40, v_route_north_id, true),
    (v_bus_2_id, 'DL-01-CC-1002', 35, v_route_hostel_id, true)
  ON CONFLICT (plate_no) DO UPDATE SET
    capacity = EXCLUDED.capacity,
    route_id = EXCLUDED.route_id,
    is_active = EXCLUDED.is_active;

  -- 4. Insert Initial Mock Bus Location for DL-01-CC-1001
  INSERT INTO public.bus_locations (bus_id, lat, lng, speed_kmh, heading, is_mock, updated_at)
  VALUES (v_bus_1_id, 28.6139, 77.2090, 24.5, 45.0, true, now())
  ON CONFLICT (bus_id) DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    speed_kmh = EXCLUDED.speed_kmh,
    heading = EXCLUDED.heading,
    is_mock = EXCLUDED.is_mock,
    updated_at = now();

  -- 5. Insert Sample System Alerts
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
