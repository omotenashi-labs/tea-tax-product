import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { pathToFileURL } from 'url';
import { describe, expect, it } from 'vitest';
import {
  resolveDatabaseUrls,
  resolveAuditSchemaSqlPath,
  resolveSchemaSqlPath,
  splitSqlStatements,
} from './index';

describe('resolveDatabaseUrls', () => {
  it('uses localhost defaults when only DATABASE_URL is unset', () => {
    expect(resolveDatabaseUrls({} as NodeJS.ProcessEnv)).toEqual({
      app: 'postgres://app_rw:app_rw_password@localhost:5432/tea_tax_app',
      audit: 'postgres://audit_w:audit_w_password@localhost:5432/tea_tax_audit',
      analytics: 'postgres://analytics_w:analytics_w_password@localhost:5432/tea_tax_analytics',
    });
  });

  it('respects explicit pool environment overrides', () => {
    expect(
      resolveDatabaseUrls({
        DATABASE_URL: 'postgres://app@example/tea_tax_app',
        AUDIT_DATABASE_URL: 'postgres://audit@example/tea_tax_audit',
        ANALYTICS_DATABASE_URL: 'postgres://analytics@example/tea_tax_analytics',
      } as NodeJS.ProcessEnv),
    ).toEqual({
      app: 'postgres://app@example/tea_tax_app',
      audit: 'postgres://audit@example/tea_tax_audit',
      analytics: 'postgres://analytics@example/tea_tax_analytics',
    });
  });

  it('falls back independently when audit or analytics URLs are missing', () => {
    expect(
      resolveDatabaseUrls({
        DATABASE_URL: 'postgres://app@example/tea_tax_app',
        AUDIT_DATABASE_URL: 'postgres://audit@example/tea_tax_audit',
      } as NodeJS.ProcessEnv),
    ).toEqual({
      app: 'postgres://app@example/tea_tax_app',
      audit: 'postgres://audit@example/tea_tax_audit',
      analytics: 'postgres://analytics_w:analytics_w_password@localhost:5432/tea_tax_analytics',
    });
  });
});

describe('splitSqlStatements', () => {
  it('splits simple statements on semicolons', () => {
    expect(splitSqlStatements('SELECT 1; SELECT 2')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('does not split inside dollar-quoted blocks', () => {
    const sql = `
CREATE OR REPLACE FUNCTION foo()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('chan', NEW.id::TEXT);
  RETURN NEW;
END
$$;
SELECT 1
`.trim();
    const parts = splitSqlStatements(sql);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('PERFORM pg_notify');
    expect(parts[1]).toBe('SELECT 1');
  });

  it('returns an empty array for blank input', () => {
    expect(splitSqlStatements('   ')).toEqual([]);
  });

  it('handles trailing content without a final semicolon', () => {
    expect(splitSqlStatements('SELECT 1; SELECT 2')).toContain('SELECT 2');
  });
});

describe('resolveSchemaSqlPath', () => {
  it('prefers schema.sql adjacent to the module', () => {
    expect(resolveSchemaSqlPath(import.meta.url)).toMatch(/packages\/db\/schema\.sql$/);
  });

  it('falls back to packaged schema.sql when running from a bundled dist directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'tea-tax-schema-path-'));
    const distDir = join(root, 'dist');
    const packagedDir = join(root, 'packages', 'db');
    mkdirSync(distDir, { recursive: true });
    mkdirSync(packagedDir, { recursive: true });
    writeFileSync(join(packagedDir, 'schema.sql'), '-- test schema');

    try {
      expect(resolveSchemaSqlPath(pathToFileURL(join(distDir, 'server.js')).href, root)).toBe(
        join(packagedDir, 'schema.sql'),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('resolveAuditSchemaSqlPath', () => {
  it('prefers audit-schema.sql adjacent to the module', () => {
    expect(resolveAuditSchemaSqlPath(import.meta.url)).toMatch(/packages\/db\/audit-schema\.sql$/);
  });

  it('falls back to packaged audit-schema.sql when running from a bundled dist directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'tea-tax-audit-schema-path-'));
    const distDir = join(root, 'dist');
    const packagedDir = join(root, 'packages', 'db');
    mkdirSync(distDir, { recursive: true });
    mkdirSync(packagedDir, { recursive: true });
    writeFileSync(join(packagedDir, 'audit-schema.sql'), '-- test audit schema');

    try {
      expect(resolveAuditSchemaSqlPath(pathToFileURL(join(distDir, 'server.js')).href, root)).toBe(
        join(packagedDir, 'audit-schema.sql'),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
