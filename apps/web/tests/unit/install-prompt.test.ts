/**
 * Unit tests for the install prompt component's exported logic:
 * - isDismissalActive: TTL-based dismissal with legacy 'true' handling
 * - resolveInstallPath: feature-detection-driven install path resolution
 */

import { describe, test, expect } from 'vitest';
import {
  isDismissalActive,
  DISMISS_TTL_MS,
  resolveInstallPath,
} from '../../src/components/pwa/install-prompt.js';

// ---------------------------------------------------------------------------
// isDismissalActive
// ---------------------------------------------------------------------------

describe('isDismissalActive', () => {
  test('null stored value returns false', () => {
    expect(isDismissalActive(null)).toBe(false);
  });

  test('legacy permanent "true" is treated as expired (returns false)', () => {
    expect(isDismissalActive('true')).toBe(false);
  });

  test('recent timestamp returns true', () => {
    const now = Date.now();
    const recentTs = String(now - 1000); // 1 second ago
    expect(isDismissalActive(recentTs, now)).toBe(true);
  });

  test('expired timestamp (> 90 days) returns false', () => {
    const now = Date.now();
    const expiredTs = String(now - DISMISS_TTL_MS - 1); // just over 90 days ago
    expect(isDismissalActive(expiredTs, now)).toBe(false);
  });

  test('boundary: exactly at TTL returns false (not strictly less than)', () => {
    const now = Date.now();
    const boundaryTs = String(now - DISMISS_TTL_MS); // exactly 90 days ago
    expect(isDismissalActive(boundaryTs, now)).toBe(false);
  });

  test('boundary: 1ms before TTL expiry returns true', () => {
    const now = Date.now();
    const almostExpired = String(now - DISMISS_TTL_MS + 1);
    expect(isDismissalActive(almostExpired, now)).toBe(true);
  });

  test('non-numeric garbage string returns false', () => {
    expect(isDismissalActive('garbage')).toBe(false);
  });

  test('empty string returns false', () => {
    expect(isDismissalActive('')).toBe(false);
  });

  test('NaN-producing string returns false', () => {
    expect(isDismissalActive('NaN')).toBe(false);
  });

  test('Infinity string returns false', () => {
    expect(isDismissalActive('Infinity')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveInstallPath
// ---------------------------------------------------------------------------

describe('resolveInstallPath', () => {
  test('standalone mode returns "none" regardless of other flags', () => {
    expect(
      resolveInstallPath({
        supportsBeforeInstallPrompt: true,
        isStandalone: true,
        os: 'android',
        browser: 'chrome',
      }),
    ).toBe('none');
  });

  test('browser with beforeinstallprompt support returns "native-prompt"', () => {
    expect(
      resolveInstallPath({
        supportsBeforeInstallPrompt: true,
        isStandalone: false,
        os: 'android',
        browser: 'chrome',
      }),
    ).toBe('native-prompt');
  });

  test('iOS Safari without beforeinstallprompt returns "ios-safari"', () => {
    expect(
      resolveInstallPath({
        supportsBeforeInstallPrompt: false,
        isStandalone: false,
        os: 'ios',
        browser: 'safari',
      }),
    ).toBe('ios-safari');
  });

  test('iOS Chrome (CriOS) returns "ios-non-safari"', () => {
    expect(
      resolveInstallPath({
        supportsBeforeInstallPrompt: false,
        isStandalone: false,
        os: 'ios',
        browser: 'chrome',
      }),
    ).toBe('ios-non-safari');
  });

  test('iOS Firefox (FxiOS) returns "ios-non-safari"', () => {
    expect(
      resolveInstallPath({
        supportsBeforeInstallPrompt: false,
        isStandalone: false,
        os: 'ios',
        browser: 'firefox',
      }),
    ).toBe('ios-non-safari');
  });

  test('desktop Chrome without beforeinstallprompt returns "none"', () => {
    expect(
      resolveInstallPath({
        supportsBeforeInstallPrompt: false,
        isStandalone: false,
        os: 'windows',
        browser: 'chrome',
      }),
    ).toBe('none');
  });

  test('desktop Edge with beforeinstallprompt returns "native-prompt"', () => {
    expect(
      resolveInstallPath({
        supportsBeforeInstallPrompt: true,
        isStandalone: false,
        os: 'windows',
        browser: 'edge',
      }),
    ).toBe('native-prompt');
  });
});

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

describe('InstallPrompt module exports', () => {
  test('InstallPrompt is exported from the module', async () => {
    const mod = await import('../../src/components/pwa/install-prompt.js');
    expect(typeof mod.InstallPrompt).toBe('function');
  });

  test('DISMISSED_KEY constant is stable', async () => {
    const mod = await import('../../src/components/pwa/install-prompt.js');
    expect(mod.DISMISSED_KEY).toBe('tea-tax:pwa-install-dismissed');
  });

  test('DISMISS_TTL_MS is 90 days in milliseconds', async () => {
    const mod = await import('../../src/components/pwa/install-prompt.js');
    expect(mod.DISMISS_TTL_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });
});
