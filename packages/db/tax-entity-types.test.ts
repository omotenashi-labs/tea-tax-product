/**
 * Migration tests for tax_object and tax_return entity types (issue #17).
 *
 * Verifies:
 * 1. tax_object and tax_return entity types are seeded after migration.
 * 2. situation_data is listed as a sensitive field on tax_return.
 * 3. Migration is idempotent — running it twice does not error.
 * 4. The partial unique index prevents duplicate tax_return filings with
 *    the same (tax_object_id, tax_year, jurisdiction, return_type).
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import postgres from 'postgres';
import { startPostgres, type PgContainer } from './pg-container';
import { migrate } from './index';

let pg: PgContainer;
let sql: ReturnType<typeof postgres>;

beforeAll(async () => {
  pg = await startPostgres();
  await migrate({ databaseUrl: pg.url });
  sql = postgres(pg.url, { max: 3, connect_timeout: 10 });
}, 120_000);

afterAll(async () => {
  await sql?.end({ timeout: 5 });
  await pg?.stop();
});

describe('tax_object entity type', () => {
  test('exists in entity_types registry after migration', async () => {
    const rows = await sql`
      SELECT type FROM entity_types WHERE type = 'tax_object'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('tax_object');
  });
});

describe('tax_return entity type', () => {
  test('exists in entity_types registry after migration', async () => {
    const rows = await sql`
      SELECT type FROM entity_types WHERE type = 'tax_return'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('tax_return');
  });

  test('has situation_data listed as a sensitive field', async () => {
    const rows = await sql`
      SELECT sensitive FROM entity_types WHERE type = 'tax_return'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].sensitive).toContain('situation_data');
  });
});

describe('migration idempotency', () => {
  test('running migrate() a second time does not error', async () => {
    await expect(migrate({ databaseUrl: pg.url })).resolves.toBeUndefined();
  });
});

describe('tax_return uniqueness constraint', () => {
  test('inserting two tax_return entities with identical (tax_object_id, tax_year, jurisdiction, return_type) violates the unique constraint', async () => {
    const taxObjectId = 'test-tax-obj-unique-' + Date.now();
    const taxObjectProps = {
      object_type: 'individual',
      display_name: 'Test Object',
      created_by_user_id: 'user-1',
    };
    await sql`
      INSERT INTO entities (id, type, properties)
      VALUES (
        ${taxObjectId},
        'tax_object',
        ${sql.json(taxObjectProps)}
      )
    `;

    const commonProps = {
      tax_object_id: taxObjectId,
      tax_year: 2024,
      jurisdiction: 'federal',
      return_type: '1040',
      status: 'draft',
    };

    // Insert first tax_return — should succeed
    const id1 = 'test-tax-return-1-' + Date.now();
    await sql`
      INSERT INTO entities (id, type, properties)
      VALUES (${id1}, 'tax_return', ${sql.json(commonProps)})
    `;

    // Insert second tax_return with identical uniqueness key — must fail
    const id2 = 'test-tax-return-2-' + Date.now();
    await expect(
      sql`
        INSERT INTO entities (id, type, properties)
        VALUES (${id2}, 'tax_return', ${sql.json(commonProps)})
      `,
    ).rejects.toThrow();
  });
});
