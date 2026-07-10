/**
 * init-admin.ts
 * Creates (or updates) the platform super-admin user.
 *
 * Usage:
 *   npm run db:initadmin          (from repo root)
 *   npm run db:initadmin          (from services/api)
 *
 * Environment:
 *   DATABASE_URL  – PostgreSQL connection string (reads .env / .env.local)
 */

import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = 'super-admin@carepoint.local';
const SUPER_ADMIN_PASSWORD = 'SuperAdmin123!';
const SUPER_ADMIN_FIRST_NAME = 'Super';
const SUPER_ADMIN_LAST_NAME = 'Admin';
const ORG_ID = 'platform-org-carepoint';
const ORG_NAME = 'CarePoint Platform';

async function main() {
  console.log('🔧 Initializing super-admin user...\n');

  // Ensure a platform-level organization exists
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: { name: ORG_NAME },
    create: {
      id: ORG_ID,
      name: ORG_NAME,
    },
  });

  console.log(`✅ Organization: ${org.name} (${org.id})`);

  // Hash the password
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);

  // Upsert the super-admin user
  const user = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      passwordHash,
      firstName: SUPER_ADMIN_FIRST_NAME,
      lastName: SUPER_ADMIN_LAST_NAME,
      role: UserRole.SUPER_ADMIN,
      status: 'ACTIVE',
      organizationId: org.id,
    },
    create: {
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      firstName: SUPER_ADMIN_FIRST_NAME,
      lastName: SUPER_ADMIN_LAST_NAME,
      role: UserRole.SUPER_ADMIN,
      status: 'ACTIVE',
      organizationId: org.id,
    },
  });

  console.log(`✅ Super-admin user created/updated:`);
  console.log(`   Email:    ${user.email}`);
  console.log(`   Role:     ${user.role}`);
  console.log(`   Password: ${SUPER_ADMIN_PASSWORD}`);
  console.log(`   Org:      ${org.name}`);
  console.log('\n🎉 Done. You can now log in to the admin portal with these credentials.');
}

main()
  .catch((error) => {
    console.error('❌ Failed to initialize super-admin:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
