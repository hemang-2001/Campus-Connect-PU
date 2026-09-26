-- ==============================================================================
-- Campus Connect: Sample Users Seed
-- Run this in Supabase SQL Editor to generate ready-to-use accounts for all 3 roles:
-- 1. Student: student@campus.edu / password: student123
-- 2. Driver:  driver@campus.edu  / password: driver123
-- 3. Admin:   admin@campus.edu   / password: admin123
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001'::UUID;
  v_driver_id UUID := 'b0000000-0000-0000-0000-000000000002'::UUID;
  v_student_id UUID := 'c0000000-0000-0000-0000-000000000003'::UUID;
BEGIN
  -- Clean up prior sample users if they exist
  DELETE FROM auth.users WHERE email IN ('admin@campus.edu', 'driver@campus.edu', 'student@campus.edu');

  -- 1. Insert Administrator
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

  INSERT INTO public.profiles (id, email, mail_id, full_name, role, phone)
  VALUES (v_admin_id, 'admin@campus.edu', 'admin@campus.edu', 'Dr. Sarah Connor (Admin)', 'admin', '+91 98765 99999')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = EXCLUDED.full_name, email = EXCLUDED.email, mail_id = EXCLUDED.mail_id;

  -- 2. Insert Bus Driver
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

  INSERT INTO public.profiles (id, email, mail_id, full_name, role, phone)
  VALUES (v_driver_id, 'driver@campus.edu', 'driver@campus.edu', 'Rajesh Kumar (Driver)', 'driver', '+91 98765 12345')
  ON CONFLICT (id) DO UPDATE SET role = 'driver', full_name = EXCLUDED.full_name, email = EXCLUDED.email, mail_id = EXCLUDED.mail_id;

  -- 3. Insert Student
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

  INSERT INTO public.profiles (id, email, mail_id, full_name, role, registration_no, phone)
  VALUES (v_student_id, 'student@campus.edu', 'student@campus.edu', 'Alex Johnson (Student)', 'student', 'CS202401', '+91 98765 43210')
  ON CONFLICT (id) DO UPDATE SET role = 'student', full_name = EXCLUDED.full_name, email = EXCLUDED.email, mail_id = EXCLUDED.mail_id;

END $$;
