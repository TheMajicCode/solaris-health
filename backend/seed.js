const bcrypt = require('bcryptjs');
const db = require('./src/db');

async function seed() {
  try {
    console.log('🌱 Seeding database...');

    // Create demo user: Majd Faiz
    const passwordHash = await bcrypt.hash('demo123', 10);
    const userResult = await db.query(
      `INSERT INTO users (email, password_hash, full_name, role, bio, nostr_npub)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET full_name = $3
       RETURNING id`,
      [
        'majd@luca.health',
        passwordHash,
        'Majd Faiz',
        'builder',
        'Building sovereign health infrastructure across El Salvador & Canada. Tierra → Salud → Soberanía.',
        'npub1qt0r4x9k2v8m3n7p5x7k8a9'
      ]
    );
    const userId = userResult.rows[0].id;
    console.log('✓ User created:', userId);

    // Create credentials
    const credentials = [
      ['Verified Identity', 'verified_identity', true],
      ['Aura Clinic Owner', 'aura_clinic_owner', true],
      ['Solaris Member', 'solaris_member', true],
      ['Verified Practitioner Network', 'verified_practitioner', false],
      ['Regenerative Supporter', 'regenerative_supporter', true],
      ['Bitcoin Enabled', 'bitcoin_enabled', true],
    ];

    for (const [name, type, isPublic] of credentials) {
      await db.query(
        `INSERT INTO credentials (issuer_id, holder_id, credential_type, credential_name, public, verified_at)
         VALUES ($1, $1, $2, $3, $4, NOW())
         ON CONFLICT DO NOTHING`,
        [userId, type, name, isPublic]
      );
    }
    console.log('✓ Credentials created');

    // Create agents
    const agents = [
      ['LUCA Personal Agent', 'Personal assistant, health guide, and life-dashboard helper.', 'Request only', 94, 3],
      ['Aura Clinic Agent', 'Coordinate patients, prep treatment summaries, draft patient comms.', 'Prepare invoice', 89, 4],
      ['Solaris Coordinator Agent', 'Match patients & practitioners, coordinate programs, track partner network.', 'None', 91, 3],
      ['Practitioner Assistant', 'Help prep notes, summarize patient history, draft follow-up instructions.', 'None', 86, 2],
      ['Farmer Market Agent', 'Coordinate regenerative food orders, track deliveries, link to health plans.', 'Prepare invoice', 81, 3],
      ['Finance / GPS Agent', 'Prepare invoices, simulate splits, track rewards, flag payout issues.', 'Request only', 88, 4],
    ];

    for (const [name, purpose, wallet, trust, level] of agents) {
      await db.query(
        `INSERT INTO agents (owner_id, name, purpose, wallet_permission, trust_score, permission_level, active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT DO NOTHING`,
        [userId, name, purpose, wallet, trust, level]
      );
    }
    console.log('✓ Agents created');

    // Create contributions
    const contributions = [
      ['appointment_completed', 'Heal', 'Completed dental appointment', '+20 Health', 0, true],
      ['referral', 'Refer', 'Referred new patient', '+15 Social', 15000, true],
      ['purchase', 'Support', 'Purchased regenerative food', '+10 Regen', 0, true],
      ['content', 'Learn', 'Published educational content', '+12 Community', 0, true],
      ['onboarding', 'Build', 'Onboarded practitioner', '+25 Network', 0, true],
      ['coordination', 'Coordinate', 'Coordinated farmer delivery', '+8 Regen', 0, false],
    ];

    for (const [type, category, desc, impact, reward, isPublic] of contributions) {
      await db.query(
        `INSERT INTO contributions (user_id, event_type, category, description, impact, reward_sats, public, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT DO NOTHING`,
        [userId, type, category, desc, impact, reward, isPublic]
      );
    }
    console.log('✓ Contributions created');

    console.log('\n🎉 Seed complete!');
    console.log('📧 Demo login: majd@luca.health / demo123');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
