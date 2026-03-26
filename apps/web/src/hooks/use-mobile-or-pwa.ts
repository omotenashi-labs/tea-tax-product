/**
 * @file use-mobile-or-pwa.ts
 *
 * React hook that returns true when the user is on a mobile/touch device
 * or running the app as an installed PWA in standalone mode.
 *
 * Detection logic:
 * - `(pointer: coarse)` media query — true on touch-primary devices (phones,
 *   tablets). This is the standards-track way to distinguish touch from mouse.
 * - `(display-mode: standalone)` media query — true when the app is launched
 *   from the home screen as an installed PWA.
 * - iOS proprietary `navigator.standalone` — fallback for Safari on iOS where
 *   the standards-track media query is not supported in all versions.
 *
 * Use this hook to conditionally show UI that is only appropriate for mobile
 * or PWA contexts, such as a Take Photo button using <input capture>.
 *
 * @example
 * ```tsx
 * const isMobileOrPwa = useMobileOrPwa();
 * {isMobileOrPwa && <label>Take Photo <input type="file" accept="image/*" capture="environment" /></label>}
 * ```
 */

import { useState, useEffect } from 'react';

/** Returns true when the device is touch-primary OR the app is in standalone PWA mode. */
export function useMobileOrPwa(): boolean {
  const [value, setValue] = useState<boolean>(() => detectMobileOrPwa());

  useEffect(() => {
    // Re-evaluate on mount in case SSR/pre-render returned a stale snapshot.
    setValue(detectMobileOrPwa());

    // Listen for changes to display-mode (e.g. user installs PWA while page is open).
    const standaloneQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;

    const coarseQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)')
        : null;

    const handler = () => setValue(detectMobileOrPwa());

    standaloneQuery?.addEventListener('change', handler);
    coarseQuery?.addEventListener('change', handler);

    return () => {
      standaloneQuery?.removeEventListener('change', handler);
      coarseQuery?.removeEventListener('change', handler);
    };
  }, []);

  return value;
}

function detectMobileOrPwa(): boolean {
  if (typeof window === 'undefined') return false;

  const isCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  const isStandalone =
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return isCoarsePointer || isStandalone;
}
