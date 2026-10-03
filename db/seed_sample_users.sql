-- ==============================================================================
-- Campus Connect: Sample Users Seed
-- Ready-to-use accounts for all roles:
-- 1. Master Admin: hamang2001@gmail.com / password: admin123 (ID: adb77928-9f05-48a3-a8a4-52ff86ffd012)
-- 2. Staff Admin:  admin@campus.edu     / password: admin123
-- 3. Driver:       driver@campus.edu    / password: driver123
-- 4. Student:      student@campus.edu   / password: student123
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mail_id TEXT;

DO $$
DECLARE
  v_master_admin_id UUID := 'adb77928-9f05-48a3-a8a4-52ff86ffd012'::UUID;
  v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001'::UUID;
  v_driver_id UUID := 'b0000000-0000-0000-0000-000000000002'::UUID;
  v_student_id UUID := 'c0000000-0000-0000-0000-000000000003'::UUID;
BEGIN
  -- Clean up prior sample users if they exist
  DELETE FROM auth.identities
  WHERE user_id IN (v_admin_id, v_driver_id, v_student_id)
     OR identity_data->>'email' IN ('admin@campus.edu', 'driver@campus.edu', 'student@campus.edu');

  DELETE FROM auth.users
  WHERE email IN ('admin@campus.edu', 'driver@campus.edu', 'student@campus.edu')
     OR id IN (v_admin_id, v_driver_id, v_student_id);

  -- 1. Insert/Update Master Admin (Hemang Bairwa)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES (
    v_master_admin_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    'authenticated',
    'authenticated',
    'hamang2001@gmail.com',
    crypt('admin123', gen_salt('bf')),
    now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Hemang Bairwa (Master Admin)","role":"admin","is_approved":true}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = crypt('admin123', gen_salt('bf')),
    email_confirmed_at = now(),
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change = '',
    raw_user_meta_data = '{"full_name":"Hemang Bairwa (Master Admin)","role":"admin","is_approved":true}'::jsonb,
    updated_at = now();

  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_master_admin_id) THEN
    INSERT INTO auth.identities (
      provider_id, id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    VALUES (
      v_master_admin_id::text,
      v_master_admin_id,
      v_master_admin_id,
      jsonb_build_object('sub', v_master_admin_id::text, 'email', 'hamang2001@gmail.com', 'email_verified', true, 'phone_verified', false),
      'email',
      now(),
      now(),
      now()
    );
  END IF;

  INSERT INTO public.profiles (id, email, mail_id, full_name, role, phone)
  VALUES (v_master_admin_id, 'hamang2001@gmail.com', 'hamang2001@gmail.com', 'Hemang Bairwa (Master Admin)', 'admin', '+91 93198 24831')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = EXCLUDED.full_name, email = EXCLUDED.email, mail_id = EXCLUDED.mail_id, phone = EXCLUDED.phone;

  -- 2. Insert Staff Administrator
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
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
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Dr. Sarah Connor (Admin)","role":"admin","is_approved":true}'::jsonb,
    now(),
    now()
  );

  INSERT INTO auth.identities (
    provider_id, id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  VALUES (
    v_admin_id::text,
    v_admin_id,
    v_admin_id,
    jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@campus.edu', 'email_verified', true, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  );

  INSERT INTO public.profiles (id, email, mail_id, full_name, role, phone)
  VALUES (v_admin_id, 'admin@campus.edu', 'admin@campus.edu', 'Dr. Sarah Connor (Admin)', 'admin', '+91 98765 99999')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = EXCLUDED.full_name, email = EXCLUDED.email, mail_id = EXCLUDED.mail_id;

  -- 3. Insert Bus Driver
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
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
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Rajesh Kumar (Driver)","role":"driver","is_approved":true}'::jsonb,
    now(),
    now()
  );

  INSERT INTO auth.identities (
    provider_id, id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  VALUES (
    v_driver_id::text,
    v_driver_id,
    v_driver_id,
    jsonb_build_object('sub', v_driver_id::text, 'email', 'driver@campus.edu', 'email_verified', true, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  );

  INSERT INTO public.profiles (id, email, mail_id, full_name, role, phone)
  VALUES (v_driver_id, 'driver@campus.edu', 'driver@campus.edu', 'Rajesh Kumar (Driver)', 'driver', '+91 98765 12345')
  ON CONFLICT (id) DO UPDATE SET role = 'driver', full_name = EXCLUDED.full_name, email = EXCLUDED.email, mail_id = EXCLUDED.mail_id;

  -- 4. Insert Student
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
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
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Alex Johnson (Student)","role":"student","registration_no":"CS202401","is_approved":true}'::jsonb,
    now(),
    now()
  );

  INSERT INTO auth.identities (
    provider_id, id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  VALUES (
    v_student_id::text,
    v_student_id,
    v_student_id,
    jsonb_build_object('sub', v_student_id::text, 'email', 'student@campus.edu', 'email_verified', true, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  );

  INSERT INTO public.profiles (id, email, mail_id, full_name, role, registration_no, phone)
  VALUES (v_student_id, 'student@campus.edu', 'student@campus.edu', 'Alex Johnson (Student)', 'student', 'CS202401', '+91 98765 43210')
  ON CONFLICT (id) DO UPDATE SET role = 'student', full_name = EXCLUDED.full_name, email = EXCLUDED.email, mail_id = EXCLUDED.mail_id;

END $$;
