import { supabaseAdmin } from '../lib/supabaseAdmin.js';

async function check() {
  console.log('--- SUPABASE AUTH USERS ---');
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
  if (authErr) {
    console.error('Auth error:', authErr);
  } else {
    for (const u of authData.users) {
      console.log(`Auth User ID: ${u.id} | Email: ${u.email} | Created: ${u.created_at}`);
    }
  }

  console.log('\n--- PUBLIC PROFILES ---');
  const { data: profiles, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email, mail_id, full_name, role');
  if (profErr) {
    console.error('Profile error:', profErr);
  } else {
    for (const p of profiles) {
      console.log(`Profile ID: ${p.id} | Email: ${p.email} | MailID: ${p.mail_id} | Name: ${p.full_name} | Role: ${p.role}`);
    }
  }
  process.exit(0);
}

check();
