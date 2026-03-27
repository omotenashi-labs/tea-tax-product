/**
 * @file install-prompt.tsx
 *
 * PWA install prompt component. Uses **feature detection** as the primary
 * decision driver, with OS/browser hints only for the iOS degraded path.
 *
 * Install paths
 * -------------
 * 1. **Native prompt** (primary) — Any browser that fires `beforeinstallprompt`
 *    (Chrome, Edge, Brave, Samsung Internet, Opera on Android and desktop).
 *    We intercept the event, suppress the default mini-infobar, and present a
 *    custom banner. Tapping "Install" calls `event.prompt()` which triggers the
 *    native browser install dialog automatically.
 *
 * 2. **iOS Safari banner** (degraded) — iOS Safari does not support
 *    `beforeinstallprompt`. For iOS visitors not in standalone mode we show a
 *    concise, non-blocking banner with a single Share-icon visual hint.
 *
 * 3. **iOS non-Safari redirect** — iOS Chrome (CriOS), Firefox (FxiOS), and
 *    other iOS browsers use WebKit under the hood but cannot trigger the
 *    share-sheet "Add to Home Screen" action. We detect this case and direct
 *    the user to open the page in Safari.
 *
 * Dismissal behaviour
 * -------------------
 * - "Maybe later" — session-only skip (no localStorage write)
 * - "Not now" / "Dismiss" — writes a timestamp to localStorage with a 90-day TTL
 * - Legacy permanent `'true'` dismissals are treated as expired
 *
 * Canonical docs
 * ---------------
 * - beforeinstallprompt: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event
 * - BeforeInstallPromptEvent: https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
 */

import React, { useEffect, useState, useCallback } from 'react';
import { usePlatform } from '../../hooks/use-platform';

export const DISMISSED_KEY = 'tea-tax:pwa-install-dismissed';

/** 90 days in milliseconds */
export const DISMISS_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Check whether a previous dismissal is still active.
 *
 * Returns `true` only when localStorage contains a numeric timestamp that is
 * less than `DISMISS_TTL_MS` old. Legacy permanent `'true'` values and any
 * non-numeric / null values are treated as expired (returns `false`).
 */
export function isDismissalActive(stored: string | null, now = Date.now()): boolean {
  if (stored === null) return false;
  const ts = Number(stored);
  if (!Number.isFinite(ts)) return false; // legacy 'true' or garbage
  return now - ts < DISMISS_TTL_MS;
}

type InstallState = 'not-eligible' | 'eligible' | 'prompted' | 'installed' | 'dismissed';

/** Determine the install path based on feature detection and platform info */
export type InstallPath = 'native-prompt' | 'ios-safari' | 'ios-non-safari' | 'none';

export function resolveInstallPath(opts: {
  supportsBeforeInstallPrompt: boolean;
  isStandalone: boolean;
  os: string;
  browser: string;
}): InstallPath {
  if (opts.isStandalone) return 'none';
  // Feature detection first — if the browser supports beforeinstallprompt, use it
  if (opts.supportsBeforeInstallPrompt) return 'native-prompt';
  // iOS degraded paths
  if (opts.os === 'ios' && opts.browser === 'safari') return 'ios-safari';
  if (opts.os === 'ios') return 'ios-non-safari';
  return 'none';
}

/** Minimal typing for the non-standard BeforeInstallPromptEvent */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA install prompt component. Renders a native install banner, an iOS
 * concise banner, an iOS non-Safari redirect hint, or nothing — based on
 * feature detection and current install state.
 *
 * Mount this component near the root of the app (e.g. in App.tsx).
 */
export function InstallPrompt() {
  const { os, browser, isStandalone, supports } = usePlatform();

  const [installState, setInstallState] = useState<InstallState>('not-eligible');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [sessionDismissed, setSessionDismissed] = useState(false);

  const installPath = resolveInstallPath({
    supportsBeforeInstallPrompt: supports.beforeInstallPrompt || deferredPrompt !== null,
    isStandalone,
    os,
    browser,
  });

  // Determine eligibility on mount
  useEffect(() => {
    if (isStandalone) {
      setInstallState('installed');
      return;
    }

    // Check TTL-based dismissal
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (isDismissalActive(stored)) {
      setInstallState('dismissed');
      return;
    }

    // Listen for beforeinstallprompt (feature-detection-driven)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault(); // suppress the mini-infobar
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallState('eligible');
    };

    const handleInstalled = () => {
      setInstallState('installed');
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    // iOS paths: eligible when not standalone, not dismissed, and on iOS
    if (os === 'ios') {
      setInstallState('eligible');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [isStandalone, os, browser]);

  // Native prompt: trigger the deferred browser install dialog
  const handleNativeInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstallState('prompted');
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstallState(outcome === 'accepted' ? 'installed' : 'dismissed');
  }, [deferredPrompt]);

  // "Not now" / "Dismiss" — write timestamp with TTL
  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setInstallState('dismissed');
  }, []);

  // "Maybe later" — session-only skip (no localStorage write)
  const handleMaybeLater = useCallback(() => {
    setSessionDismissed(true);
  }, []);

  // Nothing to render in these states
  if (
    installState === 'not-eligible' ||
    installState === 'installed' ||
    installState === 'dismissed' ||
    sessionDismissed ||
    installPath === 'none'
  ) {
    return null;
  }

  // Native install banner (Android Chrome, desktop Chrome/Edge/Brave, etc.)
  if (installPath === 'native-prompt' && deferredPrompt) {
    return (
      <div
        role="banner"
        data-testid="install-banner-native"
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 bg-white border border-surface-200 rounded-lg shadow-xl p-4 flex items-center gap-4"
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: '#243b53' }}
        >
          <span className="text-white font-black text-lg">TT</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-surface-900">Install Tea Tax</p>
          <p className="text-xs text-surface-500 mt-0.5">
            Add to your home screen for the best experience
          </p>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={handleNativeInstall}
            className="px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors"
            style={{ backgroundColor: '#243b53' }}
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-lg text-surface-400 text-xs hover:text-surface-600 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  // iOS Safari concise banner — single share-icon hint, no step-by-step tutorial
  if (installPath === 'ios-safari' && installState === 'eligible') {
    return (
      <div
        role="banner"
        data-testid="install-banner-ios-safari"
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 bg-white border border-surface-200 rounded-lg shadow-xl p-4 flex items-center gap-4"
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: '#243b53' }}
        >
          <span className="text-white font-black text-lg">TT</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-surface-900">Install Tea Tax</p>
          <p className="text-xs text-surface-500 mt-0.5">
            Tap{' '}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="inline-block w-3.5 h-3.5 align-text-bottom"
              aria-label="Share"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>{' '}
            then &ldquo;Add to Home Screen&rdquo;
          </p>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={handleMaybeLater}
            className="px-3 py-1.5 rounded-lg text-surface-400 text-xs hover:text-surface-600 transition-colors"
          >
            Maybe later
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-lg text-surface-400 text-xs hover:text-surface-600 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // iOS non-Safari browser — redirect hint to open in Safari
  if (installPath === 'ios-non-safari' && installState === 'eligible') {
    return (
      <div
        role="banner"
        data-testid="install-banner-ios-non-safari"
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 bg-white border border-surface-200 rounded-lg shadow-xl p-4 flex items-center gap-4"
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: '#243b53' }}
        >
          <span className="text-white font-black text-lg">TT</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-surface-900">Install Tea Tax</p>
          <p className="text-xs text-surface-500 mt-0.5">
            Open this page in Safari to install the app
          </p>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={handleMaybeLater}
            className="px-3 py-1.5 rounded-lg text-surface-400 text-xs hover:text-surface-600 transition-colors"
          >
            Maybe later
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-lg text-surface-400 text-xs hover:text-surface-600 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return null;
}
