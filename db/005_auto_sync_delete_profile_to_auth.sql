-- ==============================================================================
-- Campus Connect: 005_auto_sync_delete_profile_to_auth.sql
-- Trigger: When a profile is deleted in public.profiles (e.g. in Supabase Studio Table Editor),
-- automatically delete the corresponding user from auth.users as well!
-- This ensures you can immediately recreate accounts with the same email.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_profile_deletion_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_deleted ON public.profiles;
CREATE TRIGGER on_profile_deleted
  AFTER DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_deletion_to_auth();

SELECT 'Trigger on_profile_deleted created: Deleting from profiles will now automatically delete from auth.users!' AS result;
