import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const SAMPLE_USERS = [
  {
    id: 'adb77928-9f05-48a3-a8a4-52ff86ffd012',
    email: 'hamang2001@gmail.com',
    password: 'admin123',
    fullName: 'Hemang Bairwa (Master Admin)',
    role: 'admin',
    phone: '+91 93198 24831'
  },
  {
    email: 'admin@campus.edu',
    password: 'admin123',
    fullName: 'Dr. Sarah Connor (Admin)',
    role: 'admin',
    phone: '+91 98765 99999'
  },
  {
    email: 'driver@campus.edu',
    password: 'driver123',
    fullName: 'Rajesh Kumar (Driver)',
    role: 'driver',
    phone: '+91 98765 12345'
  },
  {
    email: 'student@campus.edu',
    password: 'student123',
    fullName: 'Alex Johnson (Student)',
    role: 'student',
    registrationNo: 'CS202401',
    phone: '+91 98765 43210'
  }
];

async function seed() {
  console.log('🌱 Seeding sample users via Supabase Admin API...');

  for (const u of SAMPLE_USERS) {
    try {
      let userId = u.id || null;

      // 1. If explicit id is known (e.g. Master Admin), update directly
      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: u.password,
          email_confirm: true,
          user_metadata: {
            full_name: u.fullName,
            role: u.role,
            phone: u.phone,
            registration_no: u.registrationNo || null
          }
        });
        console.log(`🔄 Updated auth user: ${u.email} (${u.role}) -> ${userId}`);
      } else {
        // Try creating user directly via Supabase Auth Admin API
        const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: {
            full_name: u.fullName,
            role: u.role,
            phone: u.phone,
            registration_no: u.registrationNo || null
          }
        });

        if (!createErr && createData?.user) {
          userId = createData.user.id;
          console.log(`✅ Created auth user: ${u.email} (${u.role}) -> ${userId}`);
        } else {
          console.error(`❌ Could not create ${u.email}:`, createErr?.message);
          continue;
        }
      }

      // 2. Ensure profile row exists in public.profiles with mail_id
      if (userId) {
        const { error: profileErr } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: userId,
            mail_id: u.email,
            full_name: u.fullName,
            role: u.role,
            phone: u.phone,
            registration_no: u.registrationNo || null
          });

        if (profileErr) {
          console.warn(`⚠️ Profiles note for ${u.email}:`, profileErr.message);
        } else {
          console.log(`   Profile linked: ${u.fullName} [${u.role}]`);
        }
      }

      // 3. Test sign in
      const { error: loginErr } = await supabaseAdmin.auth.signInWithPassword({
        email: u.email,
        password: u.password
      });

      if (loginErr) {
        console.error(`   ❌ Sign-in test failed for ${u.email}:`, loginErr.message);
      } else {
        console.log(`   ✨ Sign-in verified: SUCCESS`);
      }
    } catch (err) {
      console.error(`Error processing ${u.email}:`, err);
    }
  }

  console.log('🎉 Sample user seeding process complete!');
  process.exit(0);
}

seed();
