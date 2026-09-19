-- ==============================================================================
-- Campus Connect: Fix Auth & Restore GoTrue Schema Health
-- Run this in Supabase SQL Editor to remove broken triggers and manual auth rows.
-- ==============================================================================

-- 1. Remove custom triggers from auth.users (GoTrue manages auth.users internally)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Clean up any corrupted manual user rows that were inserted without auth.identities
DELETE FROM auth.identities 
WHERE email IN ('admin@campus.edu', 'driver@campus.edu', 'student@campus.edu')
   OR identity_data->>'email' IN ('admin@campus.edu', 'driver@campus.edu', 'student@campus.edu');

DELETE FROM auth.users 
WHERE email IN ('admin@campus.edu', 'driver@campus.edu', 'student@campus.edu')
   OR id IN (
     'a0000000-0000-0000-0000-000000000001'::UUID,
     'b0000000-0000-0000-0000-000000000002'::UUID,
     'c0000000-0000-0000-0000-000000000003'::UUID
   );

-- 3. Clean up the placeholder profiles rows matching those sample IDs
DELETE FROM public.profiles 
WHERE id IN (
  'a0000000-0000-0000-0000-000000000001'::UUID,
  'b0000000-0000-0000-0000-000000000002'::UUID,
  'c0000000-0000-0000-0000-000000000003'::UUID
);

-- 4. Verify auth.users health: success message
SELECT 'Auth schema repaired successfully. You can now register or seed users!' AS result;
