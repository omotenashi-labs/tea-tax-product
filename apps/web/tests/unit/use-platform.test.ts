/**
 * Unit tests for the usePlatform hook's pure helper functions.
 *
 * The helpers `detectOs` and `detectBrowser` are now exported from
 * use-platform.ts for direct unit testing.
 */

import { describe, test, expect } from 'vitest';
import { detectOs, detectBrowser } from '../../src/hooks/use-platform.js';

// ---------------------------------------------------------------------------
// OS detection
// ---------------------------------------------------------------------------

describe('detectOs', () => {
  test('detects Android', () => {
    expect(
      detectOs(
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/113.0 Mobile Safari/537.36',
      ),
    ).toBe('android');
  });

  test('detects iOS (iPhone)', () => {
    expect(
      detectOs(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('ios');
  });

  test('detects iOS (iPad pre-13)', () => {
    expect(
      detectOs(
        'Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15 Version/12.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('ios');
  });

  test('detects iPadOS 13+ (Macintosh UA + maxTouchPoints > 1) as ios', () => {
    // iPadOS 13+ sends a Macintosh UA identical to desktop Safari
    expect(
      detectOs(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        5, // iPadOS typically reports maxTouchPoints=5
      ),
    ).toBe('ios');
  });

  test('real macOS (maxTouchPoints=0) detects as macos, not ios', () => {
    expect(
      detectOs(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        0,
      ),
    ).toBe('macos');
  });

  test('macOS without explicit maxTouchPoints defaults to macos', () => {
    expect(
      detectOs(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
      ),
    ).toBe('macos');
  });

  test('maxTouchPoints=1 is not treated as iPad (only > 1)', () => {
    expect(
      detectOs(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        1,
      ),
    ).toBe('macos');
  });

  test('detects Windows', () => {
    expect(
      detectOs(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/113.0.0.0 Safari/537.36',
      ),
    ).toBe('windows');
  });

  test('detects Linux', () => {
    expect(
      detectOs(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
      ),
    ).toBe('linux');
  });

  test('returns unknown for empty UA', () => {
    expect(detectOs('')).toBe('unknown');
  });

  test('Android takes precedence over Linux', () => {
    const androidUa =
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/113.0 Mobile Safari/537.36';
    expect(detectOs(androidUa)).toBe('android');
  });
});

// ---------------------------------------------------------------------------
// Browser detection
// ---------------------------------------------------------------------------

describe('detectBrowser', () => {
  test('detects Chrome on Android', () => {
    expect(
      detectBrowser(
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('chrome');
  });

  test('detects Safari on iOS', () => {
    expect(
      detectBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('safari');
  });

  test('detects Chrome on iOS (CriOS)', () => {
    expect(
      detectBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.169 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('chrome');
  });

  test('detects Firefox on iOS (FxiOS)', () => {
    expect(
      detectBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/119.0 Mobile/15E148 Safari/605.1.15',
      ),
    ).toBe('firefox');
  });

  test('detects Firefox', () => {
    expect(
      detectBrowser(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
      ),
    ).toBe('firefox');
  });

  test('detects Edge (Chromium-based)', () => {
    expect(
      detectBrowser(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.57',
      ),
    ).toBe('edge');
  });

  test('Edge takes precedence over Chrome when UA contains both', () => {
    const edgeUa =
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1';
    expect(detectBrowser(edgeUa)).toBe('edge');
  });

  test('returns unknown for empty UA', () => {
    expect(detectBrowser('')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Module shape sanity
// ---------------------------------------------------------------------------

describe('use-platform module exports', () => {
  test('usePlatform is exported from the module', async () => {
    const mod = await import('../../src/hooks/use-platform.js');
    expect(typeof mod.usePlatform).toBe('function');
  });

  test('detectOs is exported from the module', async () => {
    const mod = await import('../../src/hooks/use-platform.js');
    expect(typeof mod.detectOs).toBe('function');
  });

  test('detectBrowser is exported from the module', async () => {
    const mod = await import('../../src/hooks/use-platform.js');
    expect(typeof mod.detectBrowser).toBe('function');
  });
});
