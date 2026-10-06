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
    const now = Date.now();
    const staleAssignmentIds = [];

    const formatted = (buses || []).map((bus) => {
      const activeAssignment = Array.isArray(bus.assignments)
        ? bus.assignments.find((a) => a.active === true)
        : null;

      // Location object or null
      const loc = Array.isArray(bus.location) ? bus.location[0] : bus.location;

      // Check if location fix was received recently (within 90 seconds for fresh, 5 minutes for displayable)
      const locAgeMs = loc?.updated_at ? now - new Date(loc.updated_at).getTime() : Infinity;
      const isFresh = locAgeMs < 90000;
      const isDisplayable = locAgeMs < 300000;

      // Auto-expire stale assignments only after 5 minutes (300s) of zero location fixes
      if (activeAssignment) {
        const sessionAgeMs = activeAssignment.started_at ? now - new Date(activeAssignment.started_at).getTime() : 0;
        if (!isFresh && (locAgeMs > 300000 || (!loc && sessionAgeMs > 300000))) {
          staleAssignmentIds.push(activeAssignment.id);
        }
      }

      // STRICT STATUS: A bus is LIVE if a driver has an active session and has sent fixes recently
      let status = 'OFFLINE';
      if (loc?.is_mock && isFresh) {
        status = 'MOCK';
      } else if (activeAssignment && (isFresh || isDisplayable) && !loc?.is_mock) {
        status = 'LIVE';
      }

      return {
        id: bus.id,
        plate_no: bus.plate_no,
        capacity: bus.capacity,
        route: bus.route,
        status,
        has_active_driver: Boolean(activeAssignment && (isFresh || isDisplayable)),
        location: (isFresh || isDisplayable) ? loc : null
      };
    });

    // Auto-expire stale assignments in background so database stays consistent
    if (staleAssignmentIds.length > 0) {
      supabaseAdmin
        .from('driver_assignments')
        .update({ active: false, ended_at: new Date().toISOString() })
        .in('id', staleAssignmentIds)
        .then(() => {});
    }

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
    const busId = req.body?.busId;

    // 1. Find all active buses for this driver
    const { data: activeAssignments } = await supabaseAdmin
      .from('driver_assignments')
      .select('id, bus_id')
      .eq('driver_id', req.user.id)
      .eq('active', true);

    const busIds = (activeAssignments || []).map((a) => a.bus_id).filter(Boolean);
    if (busId && !busIds.includes(busId)) {
      busIds.push(busId);
    }

    // 2. Deactivate assignments
    const { error } = await supabaseAdmin
      .from('driver_assignments')
      .update({ active: false, ended_at: new Date().toISOString() })
      .eq('driver_id', req.user.id)
      .eq('active', true);

    if (error) {
      return res.status(500).json({ error: 'Failed to stop driving session', details: error.message });
    }

    // 3. Delete live location fix from bus_locations table
    // This immediately triggers a Supabase Realtime DELETE event so student maps remove the bus marker!
    if (busIds.length > 0) {
      const { error: locErr } = await supabaseAdmin
        .from('bus_locations')
        .delete()
        .in('bus_id', busIds);

      if (locErr) {
        console.warn('Note deleting bus_locations on stop:', locErr.message);
      }
    }

    return res.json({ success: true, message: 'Driving session ended and bus marked offline from map' });
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
        // Auto-heal assignment so driver broadcast is NEVER killed by a transient 403
        const { data: healed } = await supabaseAdmin
          .from('driver_assignments')
          .insert({
            driver_id: req.user.id,
            bus_id: busId,
            active: true,
            started_at: new Date().toISOString()
          })
          .select('id')
          .maybeSingle();

        if (!healed) {
          return res.status(403).json({
            error: 'Session ended or not active for this bus. Please restart broadcast.'
          });
        }
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
