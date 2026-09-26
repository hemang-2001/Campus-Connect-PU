-- ==============================================================================
-- Campus Connect: 004_add_email_and_mail_id_to_profiles.sql
-- Migration: Add 'email' and 'mail_id' columns to public.profiles table,
-- backfill from auth.users, and update the handle_new_user trigger.
-- ==============================================================================

-- 1. Add email and mail_id columns if they don't already exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS mail_id TEXT;

-- 2. Backfill existing profile rows from auth.users email
UPDATE public.profiles p
SET 
  email = COALESCE(p.email, u.email),
  mail_id = COALESCE(p.mail_id, u.email)
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.mail_id IS NULL OR p.email = '' OR p.mail_id = '');

-- 3. Update handle_new_user() trigger function to auto-populate email and mail_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
  INSERT INTO public.profiles (id, email, mail_id, full_name, role, phone, registration_no)
  VALUES (
    new.id,
    new.email,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    COALESCE(new.raw_user_meta_data->>'phone', NULL),
    COALESCE(new.raw_user_meta_data->>'registration_no', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    mail_id = EXCLUDED.mail_id,
    full_name = EXCLUDED.full_name,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    registration_no = COALESCE(public.profiles.registration_no, EXCLUDED.registration_no);
  RETURN new;
END;
$fn$;

-- 4. Re-ensure the trigger is attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

SELECT 'Migration completed: email and mail_id columns added and backfilled into public.profiles.' AS result;
