import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { clean, isRegNo } from '../utils/validate.js';

const router = Router();

/**
 * GET /api/profile/me
 * Authenticated: Returns current user's profile and role.
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, registration_no, phone, avatar_url, created_at')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) {
      console.error('Error getting profile:', error);
      return res.status(500).json({ error: 'Failed to retrieve profile', details: error.message });
    }

    return res.json({
      user: {
        id: req.user.id,
        email: req.user.email
      },
      profile: profile || req.profile
    });
  } catch (err) {
    console.error('Unexpected error in GET /profile/me:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/profile/me
 * Authenticated: Update full name, phone number, and avatar URL.
 * Note: Role cannot be updated through this endpoint.
 */
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { full_name, phone, avatar_url } = req.body;
    const updates = {};

    if (full_name !== undefined) updates.full_name = clean(full_name, 100);
    if (phone !== undefined) updates.phone = clean(phone, 20);
    if (avatar_url !== undefined) updates.avatar_url = clean(avatar_url, 500);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, full_name, role, registration_no, phone, avatar_url, created_at')
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return res.status(500).json({ error: 'Failed to update profile', details: error.message });
    }

    return res.json({
      message: 'Profile updated successfully',
      profile: updated
    });
  } catch (err) {
    console.error('Unexpected error in PATCH /profile/me:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/profile/registration
 * Student only: Updates university registration number.
 * Validates against format /^[A-Z]{2,4}\d{4,8}$/
 */
router.patch('/registration', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { registrationNo } = req.body;
    const cleanedRegNo = clean(registrationNo, 20).toUpperCase();

    if (!isRegNo(cleanedRegNo)) {
      return res.status(400).json({
        error: 'Invalid registration number format. Expected 2-4 uppercase letters followed by 4-8 digits (e.g. CS202401, EN1029384).'
      });
    }

    // Check uniqueness
    const { data: existing, error: checkErr } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('registration_no', cleanedRegNo)
      .neq('id', req.user.id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'This registration number is already registered to another account.' });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ registration_no: cleanedRegNo })
      .eq('id', req.user.id)
      .select('id, full_name, role, registration_no, phone, avatar_url, created_at')
      .single();

    if (updateErr) {
      console.error('Error updating registration number:', updateErr);
      return res.status(500).json({ error: 'Failed to update registration number', details: updateErr.message });
    }

    return res.json({
      message: 'Registration number updated successfully',
      profile: updated
    });
  } catch (err) {
    console.error('Unexpected error in PATCH /profile/registration:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
