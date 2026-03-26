/**
 * @file use-mobile-or-pwa.test.ts
 *
 * Unit tests for useMobileOrPwa hook module.
 *
 * Note: detection-logic tests that require a browser window (matchMedia,
 * navigator) live in the component test file tax-situation-form.test.tsx
 * which runs in the browser environment via vitest-browser-react.
 *
 * This file only verifies the module shape at the Node.js level, mirroring
 * the pattern used in use-platform.test.ts.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('useMobileOrPwa module shape', () => {
  test('hook source file exists at the expected path', () => {
    const hookPath = resolve(import.meta.dirname, '../../src/hooks/use-mobile-or-pwa.ts');
    const source = readFileSync(hookPath, 'utf8');
    // The hook must export useMobileOrPwa
    expect(source).toMatch(/export function useMobileOrPwa/);
  });

  test('hook source detects (pointer: coarse) media query', () => {
    const hookPath = resolve(import.meta.dirname, '../../src/hooks/use-mobile-or-pwa.ts');
    const source = readFileSync(hookPath, 'utf8');
    expect(source).toMatch(/pointer: coarse/);
  });

  test('hook source detects (display-mode: standalone) media query', () => {
    const hookPath = resolve(import.meta.dirname, '../../src/hooks/use-mobile-or-pwa.ts');
    const source = readFileSync(hookPath, 'utf8');
    expect(source).toMatch(/display-mode: standalone/);
  });

  test('hook source detects iOS navigator.standalone fallback', () => {
    const hookPath = resolve(import.meta.dirname, '../../src/hooks/use-mobile-or-pwa.ts');
    const source = readFileSync(hookPath, 'utf8');
    expect(source).toMatch(/navigator.*standalone/);
  });
});
