/**
 * PWA manifest smoke tests.
 *
 * Verifies that manifest.json contains the correct Tea Tax branding:
 * - name / short_name = "Tea Tax"
 * - theme_color = brand-800 (#243b53)
 * - background_color = brand-800 (#243b53)
 * - required icon sizes present
 *
 * Reads the static file from disk — no browser required.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, test, expect } from 'vitest';

const MANIFEST_PATH = resolve(__dirname, '../../public/manifest.json');

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface Manifest {
  name: string;
  short_name: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
}

const manifest: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

describe('PWA manifest — Tea Tax branding', () => {
  test('name is "Tea Tax"', () => {
    expect(manifest.name).toBe('Tea Tax');
  });

  test('short_name is "Tea Tax"', () => {
    expect(manifest.short_name).toBe('Tea Tax');
  });

  test('theme_color matches brand-800 (#243b53)', () => {
    expect(manifest.theme_color).toBe('#243b53');
  });

  test('background_color matches brand-800 (#243b53)', () => {
    expect(manifest.background_color).toBe('#243b53');
  });

  test('192x192 icon is declared', () => {
    const icon = manifest.icons.find((i) => i.sizes === '192x192');
    expect(icon).toBeDefined();
    expect(icon!.src).toBe('/icons/icon-192.png');
  });

  test('512x512 icon is declared', () => {
    const icon = manifest.icons.find((i) => i.sizes === '512x512');
    expect(icon).toBeDefined();
    expect(icon!.src).toBe('/icons/icon-512.png');
  });
});
