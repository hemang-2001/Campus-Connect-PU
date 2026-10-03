-- ==============================================================================
-- Campus Connect: Clean Auth Schema & Reset Sample Users
-- Run this ENTIRE script in Supabase SQL Editor.
-- ==============================================================================

-- 1. Remove any custom triggers on auth.users that might be interfering
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Delete corrupted sample user rows from auth.identities
DELETE FROM auth.identities
WHERE identity_data->>'email' IN ('admin@campus.edu', 'driver@campus.edu', 'student@campus.edu')
   OR user_id IN (
     'a0000000-0000-0000-0000-000000000001'::UUID,
     'b0000000-0000-0000-0000-000000000002'::UUID,
     'c0000000-0000-0000-0000-000000000003'::UUID
   );

-- 3. Delete corrupted sample user rows from public.profiles
DELETE FROM public.profiles
WHERE mail_id IN ('admin@campus.edu', 'driver@campus.edu', 'student@campus.edu')
   OR id IN (
     'a0000000-0000-0000-0000-000000000001'::UUID,
     'b0000000-0000-0000-0000-000000000002'::UUID,
     'c0000000-0000-0000-0000-000000000003'::UUID
   );

-- 4. Delete corrupted sample user rows from auth.users
DELETE FROM auth.users
WHERE email IN ('admin@campus.edu', 'driver@campus.edu', 'student@campus.edu')
   OR id IN (
     'a0000000-0000-0000-0000-000000000001'::UUID,
     'b0000000-0000-0000-0000-000000000002'::UUID,
     'c0000000-0000-0000-0000-000000000003'::UUID
   );

-- 5. Heal any remaining NULL tokens on existing accounts (e.g. Master Admin)
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change IS NULL;

-- 6. Recreate safe handle_new_user() trigger using mail_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
  INSERT INTO public.profiles (id, mail_id, full_name, role, phone, registration_no)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    COALESCE(new.raw_user_meta_data->>'phone', NULL),
    COALESCE(new.raw_user_meta_data->>'registration_no', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    mail_id = EXCLUDED.mail_id,
    full_name = EXCLUDED.full_name,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    registration_no = COALESCE(public.profiles.registration_no, EXCLUDED.registration_no);
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    RETURN new;
END;
$fn$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

SELECT 'Auth cleanup complete! Corrupted rows deleted, schema healthy.' AS result;
