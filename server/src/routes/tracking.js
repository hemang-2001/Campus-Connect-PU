import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isUuid, isCoord } from '../utils/validate.js';

const router = Router();

/**
 * GET /api/tracking/active
 * Public: Returns all active buses joined with their assigned route and latest location.
 */
router.get('/active', async (req, res) => {
  try {
    const { data: buses, error } = await supabaseAdmin
      .from('buses')
      .select(`
        id,
        plate_no,
        capacity,
        is_active,
        route:routes(id, name, color, is_active),
        location:bus_locations(lat, lng, speed_kmh, heading, is_mock, updated_at),
        assignments:driver_assignments(id, driver_id, active, started_at)
      `)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching active buses:', error);
      return res.status(500).json({ error: 'Failed to fetch active buses', details: error.message });
    }

    // Format response and determine live broadcast status
    const formatted = (buses || []).map((bus) => {
      const activeAssignment = Array.isArray(bus.assignments)
        ? bus.assignments.find((a) => a.active === true)
        : null;

      // Location object or null
      const loc = Array.isArray(bus.location) ? bus.location[0] : bus.location;

      // Check if location was updated within the last 30 seconds
      const isFresh = loc && (new Date().getTime() - new Date(loc.updated_at).getTime() < 30000);

      let status = 'OFFLINE';
      if (activeAssignment || isFresh) {
        status = loc?.is_mock ? 'MOCK' : 'LIVE';
      }

      return {
        id: bus.id,
        plate_no: bus.plate_no,
        capacity: bus.capacity,
        route: bus.route,
        status,
        has_active_driver: Boolean(activeAssignment),
        location: loc || null
      };
    });

    return res.json({ buses: formatted });
  } catch (err) {
    console.error('Unexpected error in /active:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tracking/start
 * Driver: Initiates a live driving session for the selected bus.
 * Returns 409 if the bus is already in an active session with another driver.
 */
router.post('/start', requireAuth, requireRole('driver', 'admin'), async (req, res) => {
  try {
    const { busId } = req.body;

    if (!isUuid(busId)) {
      return res.status(400).json({ error: 'Valid busId (UUID) is required' });
    }

    // Check if the bus exists and is active
    const { data: bus, error: busErr } = await supabaseAdmin
      .from('buses')
      .select('id, plate_no, is_active')
      .eq('id', busId)
      .maybeSingle();

    if (busErr || !bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }

    if (!bus.is_active) {
      return res.status(400).json({ error: 'This bus is currently marked inactive' });
    }

    // Check if another driver currently has an active session for this bus
    const { data: existingActive, error: searchErr } = await supabaseAdmin
      .from('driver_assignments')
      .select('id, driver_id, started_at')
      .eq('bus_id', busId)
      .eq('active', true);

    if (searchErr) {
      return res.status(500).json({ error: 'Database check failed', details: searchErr.message });
    }

    const otherDriverSession = (existingActive || []).find((a) => a.driver_id !== req.user.id);
    if (otherDriverSession) {
      return res.status(409).json({
        error: 'Bus is already in an active session with another driver. Please choose a different bus or contact the administrator.'
      });
    }

    // Deactivate any other active assignments for this driver
    await supabaseAdmin
      .from('driver_assignments')
      .update({ active: false, ended_at: new Date().toISOString() })
      .eq('driver_id', req.user.id)
      .eq('active', true);

    // Create the new active assignment
    const { data: newAssignment, error: insertErr } = await supabaseAdmin
      .from('driver_assignments')
      .insert({
        driver_id: req.user.id,
        bus_id: busId,
        active: true,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr) {
      return res.status(500).json({ error: 'Failed to start driving session', details: insertErr.message });
    }

    return res.status(201).json({
      message: 'Driving session started successfully',
      assignment: newAssignment,
      bus
    });
  } catch (err) {
    console.error('Unexpected error in /start:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tracking/stop
 * Driver: Deactivates all active assignments for the calling driver.
 */
router.post('/stop', requireAuth, requireRole('driver', 'admin'), async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('driver_assignments')
      .update({ active: false, ended_at: new Date().toISOString() })
      .eq('driver_id', req.user.id)
      .eq('active', true);

    if (error) {
      return res.status(500).json({ error: 'Failed to stop driving session', details: error.message });
    }

    return res.json({ success: true, message: 'Driving session ended' });
  } catch (err) {
    console.error('Unexpected error in /stop:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tracking/location
 * Driver: Body { busId, lat, lng, speedKmh, heading, isMock }
 * Validates UUID + coords.
 * REQUIRE an active driver_assignments row for (driver, bus) — else 403.
 * Upserts into bus_locations with server timestamp.
 */
router.post('/location', requireAuth, async (req, res) => {
  try {
    const { busId, lat, lng, speedKmh, heading, isMock } = req.body;

    if (!isUuid(busId)) {
      return res.status(400).json({ error: 'Valid busId (UUID) is required' });
    }

    const numLat = Number(lat);
    const numLng = Number(lng);

    if (!isCoord(numLat, numLng)) {
      return res.status(400).json({ error: 'Valid latitude (-90..90) and longitude (-180..180) are required' });
    }

    // Verify driver has an active assignment for this bus (Admins can bypass for testing)
    if (req.role !== 'admin') {
      const { data: activeSession, error: checkErr } = await supabaseAdmin
        .from('driver_assignments')
        .select('id')
        .eq('driver_id', req.user.id)
        .eq('bus_id', busId)
        .eq('active', true)
        .maybeSingle();

      if (checkErr || !activeSession) {
        return res.status(403).json({
          error: 'Session ended or not active for this bus. Please restart broadcast.'
        });
      }
    }

    const now = new Date().toISOString();

    // Upsert into bus_locations
    const { data: updatedLoc, error: upsertErr } = await supabaseAdmin
      .from('bus_locations')
      .upsert({
        bus_id: busId,
        lat: numLat,
        lng: numLng,
        speed_kmh: Math.max(0, Math.round(Number(speedKmh || 0) * 10) / 10),
        heading: Math.max(0, Math.round(Number(heading || 0))),
        is_mock: Boolean(isMock),
        updated_at: now
      })
      .select()
      .single();

    if (upsertErr) {
      console.error('Error upserting bus location:', upsertErr);
      return res.status(500).json({ error: 'Failed to update bus location', details: upsertErr.message });
    }

    return res.json({
      success: true,
      location: updatedLoc
    });
  } catch (err) {
    console.error('Unexpected error in /location:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
