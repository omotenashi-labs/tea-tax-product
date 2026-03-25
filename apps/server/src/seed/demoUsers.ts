/**
 * @file seed/demoUsers
 * Idempotent demo persona seeding.
 *
 * On startup this module ensures two fixed demo accounts exist so that the
 * "Demo as Admin" and "Demo as Tax Filer" buttons on the login page work
 * without manual setup.
 *
 * Credentials are intentionally fixed and public — these accounts are for
 * demonstration only and must never be created in production environments.
 * Set DEMO_SEED=false to skip seeding (e.g. in production).
 */

import type { sql as SqlPool } from 'db';

export interface SeedDemoUsersOptions {
  sql: typeof SqlPool;
}

interface DemoPersona {
  username: string;
  password: string;
  role: string;
}

const DEMO_PERSONAS: DemoPersona[] = [
  { username: 'demo_admin', password: 'demo_admin123', role: 'admin' },
  { username: 'demo_filer', password: 'demo_filer123', role: 'tax_filer' },
];

export async function seedDemoUsers({ sql }: SeedDemoUsersOptions): Promise<void> {
  if (process.env.DEMO_SEED === 'false') {
    console.log('[seed] DEMO_SEED=false — skipping demo user seeding.');
    return;
  }

  for (const persona of DEMO_PERSONAS) {
    const existing = await sql`
      SELECT id
      FROM entities
      WHERE type = 'user'
        AND properties->>'username' = ${persona.username}
      LIMIT 1
    `;

    if (existing.length > 0) {
      console.log(`[seed] Demo user '${persona.username}' already exists — skipping.`);
      continue;
    }

    const id = crypto.randomUUID();
    const passwordHash = await Bun.password.hash(persona.password);
    const properties = {
      username: persona.username,
      password_hash: passwordHash,
      role: persona.role,
    };

    await sql`
      INSERT INTO entities (id, type, properties, tenant_id)
      VALUES (${id}, 'user', ${sql.json(properties as never)}, null)
    `;

    console.log(
      `[seed] Demo user '${persona.username}' created with role '${persona.role}' (id: ${id}).`,
    );
  }
}
