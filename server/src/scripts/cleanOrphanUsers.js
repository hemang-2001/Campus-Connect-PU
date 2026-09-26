import { supabaseAdmin } from '../lib/supabaseAdmin.js';

async function cleanup() {
  console.log('🧹 Purging orphaned auth accounts from Supabase Auth...');

  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
  if (authErr) {
    console.error('Failed to list auth users:', authErr);
    process.exit(1);
  }

  const { data: profiles, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email, mail_id, role');

  if (profErr) {
    console.error('Failed to list profiles:', profErr);
    process.exit(1);
  }

  const profileIds = new Set((profiles || []).map((p) => p.id));

  // Ensure lead admin profile exists
  const leadAdminAuth = (authData?.users || []).find((u) => u.email?.toLowerCase() === 'hamang2001@gmail.com');
  if (leadAdminAuth && !profileIds.has(leadAdminAuth.id)) {
    console.log('👑 Creating lead admin profile for hamang2001@gmail.com...');
    await supabaseAdmin.from('profiles').upsert({
      id: leadAdminAuth.id,
      email: 'hamang2001@gmail.com',
      mail_id: 'hamang2001@gmail.com',
      full_name: 'Hemang Bairwa (Lead Admin)',
      role: 'admin',
      is_approved: true
    });
    profileIds.add(leadAdminAuth.id);
  }

  let deletedCount = 0;
  for (const user of authData.users) {
    if (user.email?.toLowerCase() === 'hamang2001@gmail.com') {
      continue; // keep lead admin
    }

    // If user has NO corresponding profile in public.profiles:
    if (!profileIds.has(user.id)) {
      console.log(`❌ Deleting orphaned auth user: ${user.email} (ID: ${user.id})...`);
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (delErr) {
        console.error(`   Failed to delete ${user.email}:`, delErr.message);
      } else {
        console.log(`   ✅ Successfully deleted ${user.email}`);
        deletedCount++;
      }
    }
  }

  console.log(`\n🎉 Cleanup complete! Deleted ${deletedCount} orphaned auth accounts.`);
  console.log('You can now re-register with any of those email IDs!');
  process.exit(0);
}

cleanup();
