import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { clean, isUuid } from '../utils/validate.js';

const router = Router();

const ALLOWED_CATEGORIES = ['bus', 'driver', 'route', 'app', 'other'];
const ALLOWED_STATUSES = ['open', 'in_progress', 'resolved', 'rejected'];

/**
 * GET /api/complaints
 * Returns complaints for the authenticated user (students see own; admins see all).
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('complaints')
      .select(`
        id,
        category,
        subject,
        body,
        status,
        admin_note,
        created_at,
        student:profiles(id, full_name, registration_no, phone, avatar_url)
      `)
      .order('created_at', { ascending: false });

    // Students only see their own complaints
    if (req.role !== 'admin') {
      query = query.eq('student_id', req.user.id);
    }

    const { data: complaints, error } = await query;

    if (error) {
      console.error('Error fetching complaints:', error);
      return res.status(500).json({ error: 'Failed to retrieve complaints', details: error.message });
    }

    return res.json({ complaints: complaints || [] });
  } catch (err) {
    console.error('Unexpected error in GET /complaints:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/complaints
 * Student (or authenticated user) submits a new complaint.
 * Validates category, subject (3-120 chars), and body (10-2000 chars).
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { category, subject, body } = req.body;

    const cleanedCategory = clean(category, 20).toLowerCase();
    const cleanedSubject = clean(subject, 120);
    const cleanedBody = clean(body, 2000);

    if (!ALLOWED_CATEGORIES.includes(cleanedCategory)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}`
      });
    }

    if (cleanedSubject.length < 3 || cleanedSubject.length > 120) {
      return res.status(400).json({ error: 'Subject must be between 3 and 120 characters' });
    }

    if (cleanedBody.length < 10 || cleanedBody.length > 2000) {
      return res.status(400).json({ error: 'Complaint description must be between 10 and 2000 characters' });
    }

    const { data: complaint, error } = await supabaseAdmin
      .from('complaints')
      .insert({
        student_id: req.user.id,
        category: cleanedCategory,
        subject: cleanedSubject,
        body: cleanedBody,
        status: 'open'
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting complaint:', error);
      return res.status(500).json({ error: 'Failed to file complaint', details: error.message });
    }

    return res.status(201).json({
      message: 'Complaint submitted successfully',
      complaint
    });
  } catch (err) {
    console.error('Unexpected error in POST /complaints:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/complaints/:id
 * Admin only: Updates complaint status and/or admin resolution notes.
 */
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_note } = req.body;

    if (!isUuid(id)) {
      return res.status(400).json({ error: 'Invalid complaint ID' });
    }

    const updates = {};

    if (status !== undefined) {
      const cleanedStatus = clean(status, 20).toLowerCase();
      if (!ALLOWED_STATUSES.includes(cleanedStatus)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}`
        });
      }
      updates.status = cleanedStatus;
    }

    if (admin_note !== undefined) {
      updates.admin_note = clean(admin_note, 2000);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid update fields provided' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('complaints')
      .update(updates)
      .eq('id', id)
      .select(`
        id,
        category,
        subject,
        body,
        status,
        admin_note,
        created_at,
        student:profiles(id, full_name, registration_no, phone)
      `)
      .single();

    if (error) {
      console.error('Error updating complaint:', error);
      return res.status(500).json({ error: 'Failed to update complaint', details: error.message });
    }

    return res.json({
      message: 'Complaint updated successfully',
      complaint: updated
    });
  } catch (err) {
    console.error('Unexpected error in PATCH /complaints/:id:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
