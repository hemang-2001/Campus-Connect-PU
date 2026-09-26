import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const SAMPLE_USERS = [
  {
    email: 'hamang2001@gmail.com',
    fullName: 'Hemang Bairwa (Lead Admin)',
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
      // Check if user already exists
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
      const existing = (userList?.users || []).find((x) => x.email === u.email);

      let userId = existing?.id;

      if (!existing) {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
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

        if (error) {
          console.error(`❌ Failed to create ${u.email}:`, error.message);
          continue;
        }
        userId = data.user.id;
        console.log(`✅ Created auth user: ${u.email} (${u.role})`);
      } else {
        // Update password & metadata for existing
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: u.password,
          email_confirm: true,
          user_metadata: {
            full_name: u.fullName,
            role: u.role,
            phone: u.phone,
            registration_no: u.registrationNo || null
          }
        });
        console.log(`🔄 Updated auth user: ${u.email} (${u.role})`);
      }

      // Ensure profile row exists and has correct role
      if (userId) {
        const { error: profileErr } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: userId,
            email: u.email,
            mail_id: u.email,
            full_name: u.fullName,
            role: u.role,
            phone: u.phone,
            registration_no: u.registrationNo || null
          });

        if (profileErr) {
          console.warn(`⚠️ Note on profiles upsert for ${u.email}:`, profileErr.message);
        } else {
          console.log(`   Profile linked: ${u.fullName} [${u.role}]`);
        }
      }
    } catch (err) {
      console.error(`Error processing ${u.email}:`, err);
    }
  }

  console.log('🎉 Sample user seeding complete!');
  process.exit(0);
}

seed();
