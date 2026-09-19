import { supabaseAdmin } from '../lib/supabaseAdmin.js';

/**
 * Middleware: requireAuth
 * Validates the Authorization Bearer JWT against Supabase Auth,
 * retrieves the user profile and role, and attaches them to req.user, req.profile, and req.role.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }

    // Validate token with Supabase Auth
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({
        error: 'Invalid or expired session token',
        details: authError?.message
      });
    }

    // Retrieve user profile to determine role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
    }

    let finalProfile = profile;

    // If profile row doesn't exist yet, insert a fallback student profile
    if (!finalProfile) {
      const fallbackProfile = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        role: user.user_metadata?.role || 'student',
        phone: user.user_metadata?.phone || null,
        registration_no: user.user_metadata?.registration_no || null
      };

      const { data: createdProfile } = await supabaseAdmin
        .from('profiles')
        .insert(fallbackProfile)
        .select()
        .maybeSingle();

      finalProfile = createdProfile || fallbackProfile;
    }

    req.user = user;
    req.profile = finalProfile;
    req.role = finalProfile.role || 'student';

    next();
  } catch (err) {
    console.error('Unexpected auth middleware error:', err);
    return res.status(500).json({ error: 'Internal authentication error' });
  }
}

/**
 * Middleware: requireRole
 * Restricts access to one or more authorized roles.
 * @param  {...string} roles Allowed roles (e.g. 'student', 'driver', 'admin')
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.role) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.role)) {
      return res.status(403).json({
        error: `Forbidden: Access restricted to [${roles.join(', ')}]. Your role is '${req.role}'.`
      });
    }

    next();
  };
}
