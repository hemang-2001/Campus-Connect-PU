import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { clean, isUuid } from '../utils/validate.js';

const router = Router();

const ALLOWED_SEVERITIES = ['info', 'warning', 'critical'];

/**
 * GET /api/alerts
 * Public: Fetches all broadcast alerts ordered by newest first.
 */
router.get('/', async (req, res) => {
  try {
    const { data: alerts, error } = await supabaseAdmin
      .from('alerts')
      .select(`
        id,
        title,
        body,
        severity,
        route_id,
        created_at,
        route:routes(id, name, color),
        creator:profiles(id, full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching alerts:', error);
      return res.status(500).json({ error: 'Failed to retrieve alerts', details: error.message });
    }

    return res.json({ alerts: alerts || [] });
  } catch (err) {
    console.error('Unexpected error in GET /alerts:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/alerts
 * Admin only: Dispatches a new campus shuttle broadcast alert.
 */
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { title, body, severity, route_id } = req.body;

    const cleanedTitle = clean(title, 200);
    const cleanedBody = clean(body, 2000);
    const cleanedSeverity = clean(severity, 20).toLowerCase() || 'info';

    if (cleanedTitle.length < 3) {
      return res.status(400).json({ error: 'Title must be at least 3 characters' });
    }

    if (cleanedBody.length < 5) {
      return res.status(400).json({ error: 'Body must be at least 5 characters' });
    }

    if (!ALLOWED_SEVERITIES.includes(cleanedSeverity)) {
      return res.status(400).json({
        error: `Severity must be one of: ${ALLOWED_SEVERITIES.join(', ')}`
      });
    }

    let routeIdVal = null;
    if (route_id) {
      if (!isUuid(route_id)) {
        return res.status(400).json({ error: 'Invalid route_id UUID' });
      }
      routeIdVal = route_id;
    }

    const { data: alert, error } = await supabaseAdmin
      .from('alerts')
      .insert({
        title: cleanedTitle,
        body: cleanedBody,
        severity: cleanedSeverity,
        route_id: routeIdVal,
        created_by: req.user.id
      })
      .select(`
        id,
        title,
        body,
        severity,
        route_id,
        created_at,
        route:routes(id, name, color)
      `)
      .single();

    if (error) {
      console.error('Error inserting alert:', error);
      return res.status(500).json({ error: 'Failed to create alert', details: error.message });
    }

    return res.status(201).json({
      message: 'Alert published successfully',
      alert
    });
  } catch (err) {
    console.error('Unexpected error in POST /alerts:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
