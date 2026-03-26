/**
 * @file csrf.ts
 *
 * Reads the CSRF token from the JS-readable cookie set at login.
 * The server sets __Host-csrf-token as a non-HttpOnly cookie so that
 * frontend code can include it in mutating requests as X-CSRF-Token.
 */

/**
 * Returns the value of the __Host-csrf-token cookie, or an empty string
 * if the cookie is not present (e.g. the user is not logged in).
 */
export function getCsrfToken(): string {
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('__Host-csrf-token='));
  if (!match) return '';
  return decodeURIComponent(match.slice('__Host-csrf-token='.length));
}
