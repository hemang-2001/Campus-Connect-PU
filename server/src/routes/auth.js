import { Router } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const ADMIN_EMAIL = 'hamang2001@gmail.com';

/**
 * GET /api/auth/approve
 * Called when the lead administrator clicks the one-click approval button in Resend email.
 */
router.get('/approve', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send('<h1>Invalid Request</h1><p>Approval token is missing.</p>');
  }

  try {
    const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) {
      console.error('Error listing users for approval:', listErr);
      return res.status(500).send('<h1>Error</h1><p>Failed to query users.</p>');
    }

    const userToApprove = (userList?.users || []).find(
      (u) => u.user_metadata?.approval_token === token
    );

    if (!userToApprove) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Approval Link Expired or Not Found</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 40px 16px; display: flex; justify-content: center; }
            .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 36px 28px; max-width: 480px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.06); text-align: center; }
            h2 { color: #e11d48; margin-bottom: 8px; }
            p { color: #64748b; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
            a { color: #2563eb; font-weight: 600; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Approval Link Not Found or Expired</h2>
            <p>This staff member may have already been approved, or the authorization token is invalid.</p>
            <a href="http://localhost:5173/login">Return to Campus Connect PU &rarr;</a>
          </div>
        </body>
        </html>
      `);
    }

    // 1. Update user metadata in Supabase Auth: is_approved = true, clear approval_token
    await supabaseAdmin.auth.admin.updateUserById(userToApprove.id, {
      user_metadata: {
        ...userToApprove.user_metadata,
        is_approved: true,
        approval_token: null,
        approved_at: new Date().toISOString()
      }
    });

    // 2. Also ensure profiles table has the user with their approved role
    try {
      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userToApprove.id,
          email: userToApprove.email,
          mail_id: userToApprove.email,
          role: userToApprove.user_metadata?.role || 'driver',
          full_name: userToApprove.user_metadata?.full_name || ''
        });
    } catch (profErr) {
      console.warn('Note on profile upsert during approval:', profErr.message);
    }

    const userEmail = userToApprove.email;
    const role = (userToApprove.user_metadata?.role || 'driver').toUpperCase();
    const name = userToApprove.user_metadata?.full_name || userEmail;

    console.log(`\n======================================================`);
    console.log(`✅ STAFF ACCESS APPROVED:`);
    console.log(`   User: ${userEmail}`);
    console.log(`   Role: ${role}`);
    console.log(`   Approved by: ${ADMIN_EMAIL}`);
    console.log(`======================================================\n`);

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Campus Connect - Staff Approved</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 40px 16px; display: flex; justify-content: center; }
          .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 36px 28px; max-width: 480px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.06); text-align: center; }
          .icon { width: 64px; height: 64px; background: #dcfce7; color: #16a34a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px; }
          h1 { font-size: 22px; font-weight: 800; margin-bottom: 8px; color: #0f172a; }
          p { color: #64748b; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
          .badge { display: inline-block; background: #eff6ff; color: #1d4ed8; padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 12px; margin-bottom: 16px; }
          .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px; }
          .btn:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <span class="badge">${role} APPROVED</span>
          <h1>Staff Access Approved!</h1>
          <p>You have approved <strong>${name}</strong> (${userEmail}) for system access as a <strong>${role}</strong>.<br><br>The user can now sign in to Campus Connect using their password.</p>
          <a href="http://localhost:5173/login" class="btn">Open Campus Connect &rarr;</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Error in /approve:', err);
    return res.status(500).send('<h1>Server Error</h1><p>Failed to process approval.</p>');
  }
});

/**
 * POST /api/auth/register
 * Creates a pre-confirmed user via Supabase Admin API (bypassing Supabase email rate limits).
 * For driver/admin roles:
 *  - is_approved is set to false (until admin approves)
 *  - Confirmation email with clickable approval link is dispatched via Resend ONLY to hamang2001@gmail.com
 *  - User is returned with pendingApproval: true so client puts them in a waiting state
 * For students:
 *  - is_approved is true
 *  - Direct login enabled
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, role = 'student', registrationNo, phone, clientOrigin } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRole = (role === 'admin' || role === 'driver') ? role : 'student';
    const isLeadAdmin = cleanEmail === ADMIN_EMAIL.toLowerCase();

    // 1. Check if account already exists in the database (public.profiles)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, email, mail_id, registration_no')
      .or(`email.ilike.${cleanEmail},mail_id.ilike.${cleanEmail}`)
      .maybeSingle();

    // Check auth.users as well
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = (userList?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);

    // Only return 'already exists' if the account ACTUALLY exists in the database (profiles table) AND in auth!
    if (existingProfile && existingAuthUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists. Please log in directly.'
      });
    }

    // Check registration number uniqueness in database for students
    if (registrationNo && userRole === 'student') {
      const cleanReg = registrationNo.trim().toUpperCase();
      const { data: existingReg } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('registration_no', cleanReg)
        .maybeSingle();

      if (existingReg && existingReg.id !== existingAuthUser?.id) {
        return res.status(409).json({
          success: false,
          error: `Registration number ${cleanReg} is already registered to another account.`
        });
      }
    }

    // If an orphaned auth user exists in auth.users but has NO profile in the database:
    // Remove the dangling auth user so a fresh account and database profile can be created cleanly!
    if (existingAuthUser && !existingProfile) {
      console.log(`🧹 Removing orphaned auth user (${existingAuthUser.id}) for ${cleanEmail} because it does not exist in database profiles.`);
      try {
        await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);
      } catch (delErr) {
        console.warn('Note deleting orphaned auth user:', delErr.message);
      }
    }

    // If an orphaned database profile exists without an auth user, clean it up:
    if (existingProfile && !existingAuthUser) {
      console.log(`🧹 Removing orphaned database profile (${existingProfile.id}) for ${cleanEmail} because no auth user exists.`);
      try {
        await supabaseAdmin.from('profiles').delete().eq('id', existingProfile.id);
      } catch (delProfErr) {
        console.warn('Note deleting orphaned profile:', delProfErr.message);
      }
    }

    // 2. Determine approval status:
    // Students and lead admin are pre-approved. Other drivers and admins must wait for admin approval!
    const isApproved = userRole === 'student' || isLeadAdmin;
    const approvalToken = isApproved ? null : crypto.randomBytes(24).toString('hex');

    // 3. Create pre-confirmed user via admin API
    let userId;
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || '',
        role: userRole,
        registration_no: registrationNo || null,
        phone: phone || null,
        is_approved: isApproved,
        approval_token: approvalToken
      }
    });

    if (createErr) {
      // If error indicates user already exists, double-check whether database profile exists
      if (createErr.message?.toLowerCase().includes('already') || createErr.status === 422) {
        const { data: dbCheck } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .or(`email.ilike.${cleanEmail},mail_id.ilike.${cleanEmail}`)
          .maybeSingle();

        if (dbCheck) {
          return res.status(409).json({
            success: false,
            error: 'An account with this email address already exists. Please log in directly.'
          });
        }

        // Account does NOT exist in database! Recover by updating password and metadata on the auth user
        const { data: currentUsers } = await supabaseAdmin.auth.admin.listUsers();
        const orphan = (currentUsers?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);
        if (orphan) {
          const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(orphan.id, {
            password,
            email_confirm: true,
            user_metadata: {
              full_name: fullName || '',
              role: userRole,
              registration_no: registrationNo || null,
              phone: phone || null,
              is_approved: isApproved,
              approval_token: approvalToken
            }
          });
          if (updateErr) {
            return res.status(400).json({ success: false, error: updateErr.message });
          }
          userId = orphan.id;
        } else {
          return res.status(400).json({ success: false, error: createErr.message });
        }
      } else {
        console.error('Supabase admin createUser error:', createErr);
        return res.status(400).json({ success: false, error: createErr.message });
      }
    } else {
      userId = newUser.user.id;
    }

    // 4. Upsert user profile into profiles table in database
    try {
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email: cleanEmail,
          mail_id: cleanEmail,
          full_name: fullName || '',
          role: userRole,
          registration_no: registrationNo || null,
          phone: phone || null
        });

      if (profileErr) {
        console.error('Database profile upsert error:', profileErr);
      }
    } catch (profileErr) {
      console.warn('Note on profile upsert:', profileErr.message);
    }

    // 5. If driver/admin and NOT lead admin: send confirmation email via RESEND ONLY to hamang2001@gmail.com
    if (!isApproved) {
      const serverPort = process.env.PORT || 4000;
      const approvalUrl = `http://localhost:${serverPort}/api/auth/approve?token=${approvalToken}`;

      console.log(`\n======================================================`);
      console.log(`🛡️ NEW REGISTRATION AWAITING APPROVAL:`);
      console.log(`   Applicant: ${fullName || cleanEmail} (${cleanEmail})`);
      console.log(`   Role: ${userRole.toUpperCase()}`);
      console.log(`   Approval Link: ${approvalUrl}`);
      console.log(`   Sending confirmation via RESEND ONLY to: ${ADMIN_EMAIL}`);
      console.log(`======================================================\n`);

      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        try {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: `${cleanEmail} <onboarding@resend.dev>`,
              to: ADMIN_EMAIL,
              subject: `[ACTION REQUIRED] Approve ${userRole.toUpperCase()} Access: ${cleanEmail}`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.05);">
                  <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
                    <h2 style="margin: 0; font-size: 22px; font-weight: 800;">Campus Connect PU</h2>
                    <p style="margin: 6px 0 0; font-size: 13px; color: #bfdbfe; text-transform: uppercase; letter-spacing: 0.5px;">Staff Access Authorization</p>
                  </div>
                  <div style="padding: 32px 24px;">
                    <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 12px;">Hello Hemang,</p>
                    <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px;">
                      A new user has registered for <strong>${userRole.toUpperCase()}</strong> access on Campus Connect PU. Their account is currently <strong>WAITING FOR YOUR APPROVAL</strong> and cannot sign in until you click the authorization link below.
                    </p>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
                      <table style="width: 100%; font-size: 14px; color: #334155;">
                        <tr><td style="padding: 4px 0; font-weight: 600; width: 110px;">Applicant:</td><td>${fullName || cleanEmail}</td></tr>
                        <tr><td style="padding: 4px 0; font-weight: 600;">Email:</td><td>${cleanEmail}</td></tr>
                        <tr><td style="padding: 4px 0; font-weight: 600;">Role:</td><td><span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 12px;">${userRole.toUpperCase()}</span></td></tr>
                        <tr><td style="padding: 4px 0; font-weight: 600;">Phone:</td><td>${phone || 'Not provided'}</td></tr>
                        <tr><td style="padding: 4px 0; font-weight: 600;">Submitted:</td><td>${new Date().toLocaleString()}</td></tr>
                      </table>
                    </div>
                    <div style="text-align: center; margin: 28px 0;">
                      <a href="${approvalUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 15px; display: inline-block;">
                        Approve Staff Access &rarr;
                      </a>
                    </div>
                    <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 20px;">
                      Direct link: <a href="${approvalUrl}" style="color: #2563eb;">${approvalUrl}</a>
                    </p>
                  </div>
                </div>
              `
            })
          });

          const resData = await resendResponse.json();
          if (resData.id) {
            console.log(`✉️ Resend email successfully delivered to ${ADMIN_EMAIL} (Email ID: ${resData.id})`);
          } else {
            console.warn('Resend response:', resData);
          }
        } catch (resendErr) {
          console.error('Error calling Resend API:', resendErr);
        }
      } else {
        console.warn('⚠️ RESEND_API_KEY is not configured in server/.env');
      }

      // Return response indicating the user is waiting for approval
      return res.status(201).json({
        success: true,
        pendingApproval: true,
        role: userRole,
        message: 'Registration submitted! Your staff/driver account is pending administrator approval.'
      });
    }

    // Student or pre-approved admin:
    return res.status(201).json({
      success: true,
      pendingApproval: false,
      role: userRole,
      user: newUser.user,
      message: 'Account created successfully'
    });
  } catch (err) {
    console.error('Error in /register:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * GET /api/auth/users
 * Admin only: List all registered accounts with merged approval state
 */
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, email, mail_id, registration_no, phone, created_at')
      .order('created_at', { ascending: false });

    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const authMap = new Map((authData?.users || []).map((u) => [u.id, u]));

    const users = (profiles || []).map((p) => {
      const authUser = authMap.get(p.id);
      return {
        ...p,
        email: p.email || authUser?.email || '',
        mail_id: p.mail_id || authUser?.email || '',
        is_approved: authUser?.user_metadata?.is_approved !== false
      };
    });

    return res.json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/auth/approve/:id
 * Admin only: Instantly approve a pending driver or staff member
 */
router.patch('/approve/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { data: userToApprove, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(id);

    if (getUserErr || !userToApprove?.user) {
      return res.status(404).json({ success: false, error: 'User not found in auth system' });
    }

    const u = userToApprove.user;
    const approvedRole = u.user_metadata?.role || 'driver';

    // 1. Update user metadata in auth.users
    await supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: {
        ...u.user_metadata,
        is_approved: true,
        approval_token: null,
        approved_at: new Date().toISOString()
      }
    });

    // 2. Ensure profile table has role
    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: id,
        email: u.email,
        mail_id: u.email,
        role: approvedRole,
        full_name: u.user_metadata?.full_name || u.email.split('@')[0]
      });

    return res.json({
      success: true,
      message: `Account for ${u.email} has been approved as ${approvedRole.toUpperCase()}!`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/auth/users/:id
 * Admin only: Delete any user permanently from both profiles and auth.users
 */
router.delete('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    // 1. Delete from profiles
    await supabaseAdmin.from('profiles').delete().eq('id', id);

    // 2. Delete from auth.users
    await supabaseAdmin.auth.admin.deleteUser(id);

    return res.json({
      success: true,
      message: 'Account permanently deleted from database and auth systems.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/auth/me
 * Authenticated user: Delete own account permanently
 */
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Lead admin account cannot be deleted.' });
    }

    // 1. Delete from profiles
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // 2. Delete from auth.users
    await supabaseAdmin.auth.admin.deleteUser(userId);

    return res.json({
      success: true,
      message: 'Your account has been permanently deleted.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
